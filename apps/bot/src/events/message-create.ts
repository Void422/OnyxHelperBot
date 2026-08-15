import { EmbedBuilder, PermissionFlagsBits, type GuildMember, type Message } from "discord.js";
import { levelFromXp } from "@/packages/core/src/leveling";
import { XpPolicy, type XpPolicyConfig } from "@/packages/core/src/xp-policy";
import type { BotGuildConfig, OnyxApiClient } from "../api-client";
import { logger } from "../logger";
import { configuredMessage } from "../messages";

const xpPolicy = new XpPolicy();
const messageWindows = new Map<string, number[]>();
const duplicateWindows = new Map<string, string[]>();

function normalize(value: string) {
  return value.toLocaleLowerCase().replace(/\s+/g, " ").trim();
}

function configuredXp(config: BotGuildConfig): XpPolicyConfig {
  const xp = config.settings?.settings.xp;
  return {
    cooldownMs: (xp?.cooldownSeconds ?? 60) * 1_000,
    minimumLength: xp?.minimumMessageLength ?? 8,
    excludedChannelIds: xp?.excludedChannelIds ?? [],
    excludedRoleIds: xp?.excludedRoleIds ?? [],
    minAward: xp?.minAward ?? 10,
    maxAward: xp?.maxAward ?? 20,
  };
}

function isExempt(message: Message<true>, rule: BotGuildConfig["automodRules"][number]) {
  return (
    message.member?.permissions.has(PermissionFlagsBits.ManageMessages) ||
    rule.exemptChannelIds.includes(message.channelId) ||
    message.member?.roles.cache.some((role) => rule.exemptRoleIds.includes(role.id))
  );
}

async function applyAutomod(message: Message<true>, config: BotGuildConfig, api: OnyxApiClient) {
  const member = message.member;
  if (!member) return false;
  for (const rule of config.automodRules.filter((candidate) => candidate.enabled)) {
    if (isExempt(message, rule)) continue;
    const threshold = typeof rule.conditions.threshold === "number" ? rule.conditions.threshold : 5;
    const intervalSeconds = typeof rule.conditions.intervalSeconds === "number" ? rule.conditions.intervalSeconds : 8;
    let matched = false;
    let explanation = "";

    if (rule.kind === "invites" && /(?:discord\.gg|discord(?:app)?\.com\/invite)\/[\w-]+/i.test(message.content)) {
      matched = true;
      explanation = "Discord invite link";
    }
    if (rule.kind === "links" && /https?:\/\/\S+/i.test(message.content)) {
      matched = true;
      explanation = "external link";
    }
    if (rule.kind === "mentions" && message.mentions.users.size + message.mentions.roles.size >= threshold) {
      matched = true;
      explanation = `${message.mentions.users.size + message.mentions.roles.size} mentions in one message`;
    }
    if (rule.kind === "caps") {
      const letters = message.content.match(/[a-z]/gi) ?? [];
      const uppercase = message.content.match(/[A-Z]/g)?.length ?? 0;
      const percentage = typeof rule.conditions.percentage === "number" ? rule.conditions.percentage : 75;
      if (letters.length >= 12 && (uppercase / letters.length) * 100 >= percentage) {
        matched = true;
        explanation = "excessive capital letters";
      }
    }
    if (rule.kind === "blocked_words") {
      const values = Array.isArray(rule.conditions.values) ? rule.conditions.values.filter((value): value is string => typeof value === "string") : [];
      const content = normalize(message.content);
      const blocked = values.find((value) => content.includes(normalize(value)));
      if (blocked) {
        matched = true;
        explanation = "blocked phrase";
      }
    }
    if (rule.kind === "blocked_domains") {
      const values = Array.isArray(rule.conditions.values) ? rule.conditions.values.filter((value): value is string => typeof value === "string") : [];
      const content = normalize(message.content);
      const blocked = values.find((value) => content.includes(normalize(value).replace(/^https?:\/\//, "").replace(/\/$/, "")));
      if (blocked) {
        matched = true;
        explanation = "blocked domain";
      }
    }
    if (rule.kind === "new_account") {
      const minimumDays = typeof rule.conditions.minimumAccountAgeDays === "number" ? rule.conditions.minimumAccountAgeDays : 3;
      if ((Date.now() - message.author.createdTimestamp) / 86_400_000 < minimumDays && /https?:\/\/|(?:discord\.gg|discord(?:app)?\.com\/invite)\//i.test(message.content)) {
        matched = true;
        explanation = `link from an account younger than ${minimumDays} day${minimumDays === 1 ? "" : "s"}`;
      }
    }
    if (rule.kind === "duplicate") {
      const key = `${message.guildId}:${message.author.id}`;
      const recent = duplicateWindows.get(key) ?? [];
      const content = normalize(message.content);
      if (content.length >= 5 && recent.filter((value) => value === content).length >= Math.max(1, threshold - 1)) {
        matched = true;
        explanation = "repeated message";
      }
      duplicateWindows.set(key, [content, ...recent].slice(0, 8));
    }
    if (rule.kind === "spam") {
      const key = `${message.guildId}:${message.author.id}`;
      const cutoff = Date.now() - intervalSeconds * 1_000;
      const recent = (messageWindows.get(key) ?? []).filter((timestamp) => timestamp >= cutoff);
      recent.push(Date.now());
      messageWindows.set(key, recent);
      if (recent.length >= threshold) {
        matched = true;
        explanation = `${recent.length} messages in ${intervalSeconds} seconds`;
      }
    }

    if (!matched) continue;
    if (rule.actions.includes("delete") && message.deletable) await message.delete().catch(() => undefined);
    const reason = `Automod: ${explanation}.`;
    if (rule.actions.includes("warn")) {
      await api.warn({ guildId: message.guildId, userId: message.author.id, moderatorUserId: message.client.user.id, reason });
    } else {
      await api.createCase({
        guildId: message.guildId,
        targetUserId: message.author.id,
        moderatorUserId: message.client.user.id,
        action: "automod",
        reason,
        automated: true,
        relatedChannelId: message.channelId,
        relatedMessageId: message.id,
      });
    }
    if (rule.actions.includes("timeout") && member.moderatable) {
      const seconds = typeof rule.conditions.timeoutSeconds === "number" ? rule.conditions.timeoutSeconds : 600;
      await member.timeout(Math.min(seconds, 2_419_200) * 1_000, reason).catch(() => undefined);
    }
    if (rule.actions.includes("kick") && member.kickable) await member.kick(reason).catch(() => undefined);
    if (rule.actions.includes("ban") && member.bannable) await member.ban({ reason }).catch(() => undefined);

    const alertChannelId = config.settings?.settings.staffAlertChannelId ?? config.logs?.channels.automod;
    if (alertChannelId) {
      const channel = await message.guild.channels.fetch(alertChannelId).catch(() => null);
      if (channel?.isTextBased() && !channel.isDMBased() && "send" in channel) {
        await channel.send({
          embeds: [
            new EmbedBuilder()
              .setColor(0xb85c4d)
              .setTitle("Automod stepped in")
              .setDescription(`${message.author} triggered **${rule.kind.replace(/_/g, " ")}** in ${message.channel}.`)
              .addFields({ name: "Why", value: explanation }, { name: "Actions", value: rule.actions.join(", ") })
              .setTimestamp(),
          ],
          allowedMentions: { parse: [] },
        }).catch(() => undefined);
      }
    }
    return true;
  }
  return false;
}

async function applyLevelRole(message: Message<true>, member: GuildMember, config: BotGuildConfig, previousLevel: number, currentLevel: number) {
  if (currentLevel <= previousLevel) return;
  const earned = config.levelRoles.filter((reward) => reward.level > previousLevel && reward.level <= currentLevel).sort((left, right) => left.level - right.level);
  for (const reward of earned) {
    if (member.roles.cache.has(reward.roleId)) continue;
    await member.roles.add(reward.roleId, `Reached Onyx level ${reward.level}`).catch((error) => logger.warn({ event: "level.role_failed", guildId: message.guildId, userId: member.id, roleId: reward.roleId, error }));
    if (!reward.stack) {
      const lowerRoles = config.levelRoles.filter((candidate) => candidate.level < reward.level && member.roles.cache.has(candidate.roleId)).map((candidate) => candidate.roleId);
      if (lowerRoles.length) await member.roles.remove(lowerRoles, "Replaced by a higher Onyx level role").catch(() => undefined);
    }
  }
  const announcementChannelId = config.settings?.settings.levelAnnouncementChannelId;
  if (announcementChannelId) {
    const channel = await message.guild.channels.fetch(announcementChannelId).catch(() => null);
    if (channel?.isTextBased() && !channel.isDMBased() && "send" in channel) {
      const template = config.settings?.settings.messages?.levelUp ?? { content: "{mention} reached **level {level}**." };
      await channel.send(configuredMessage(template, { user: member.id, mention: `<@${member.id}>`, username: member.user.username, server: message.guild.name, memberCount: message.guild.memberCount, level: currentLevel })).catch(() => undefined);
    }
  }
}

export async function handleMessage(message: Message, api: OnyxApiClient) {
  if (!message.inGuild() || message.author.bot || !message.member) return;
  try {
    const config = await api.getGuildConfig(message.guildId);
    if (config.settings?.enabledModules.includes("automod")) {
      const blocked = await applyAutomod(message, config, api);
      if (blocked) return;
    }
    if (!config.settings?.enabledModules.includes("levels")) return;
    const decision = xpPolicy.evaluate(
      {
        guildId: message.guildId,
        channelId: message.channelId,
        userId: message.author.id,
        content: message.content,
        roleIds: message.member.roles.cache.map((role) => role.id),
        createdAt: message.createdTimestamp,
      },
      configuredXp(config),
    );
    if (!decision.award) return;
    const result = await api.awardXp({ guildId: message.guildId, userId: message.author.id, award: decision.award, occurredAt: message.createdAt });
    const previousLevel = levelFromXp(result.profile.xp - decision.award, config.settings?.settings.xp?.curve ?? "standard");
    await applyLevelRole(message, message.member, config, previousLevel, result.level);
  } catch (error) {
    logger.warn({ event: "message.handler_failed", guildId: message.guildId, messageId: message.id, error });
  }
}
