import { EmbedBuilder, type GuildMember, type PartialGuildMember } from "discord.js";
import type { GuildSettingsData, MessageTemplate } from "@/packages/core/src/domain";
import type { TemplateValues } from "@/packages/core/src/template";
import type { OnyxApiClient } from "../api-client";
import { logger } from "../logger";
import { configuredMessage } from "../messages";

function values(member: GuildMember | PartialGuildMember): TemplateValues {
  return {
    user: member.id,
    mention: `<@${member.id}>`,
    username: member.user.username,
    server: member.guild.name,
    memberCount: member.guild.memberCount,
  };
}

async function textChannel(member: GuildMember | PartialGuildMember, channelId?: string) {
  if (!channelId) return null;
  const channel = await member.guild.channels.fetch(channelId).catch(() => null);
  return channel?.isTextBased() && !channel.isDMBased() && "send" in channel ? channel : null;
}

function welcomeTemplate(settings: GuildSettingsData): MessageTemplate {
  return settings.messages?.welcome ?? { content: settings.welcomeMessage ?? "Welcome {mention} to **{server}** — you’re member **#{memberCount}**." };
}

async function sendLog(member: GuildMember | PartialGuildMember, api: OnyxApiClient, kind: "join" | "leave") {
  const config = await api.getGuildConfig(member.guild.id);
  if (!config.settings?.enabledModules.includes("logging")) return;
  const channel = await textChannel(member, config.logs?.channels.members);
  if (!channel) return;
  const joined = kind === "join";
  await channel.send({
    embeds: [
      new EmbedBuilder()
        .setColor(joined ? 0x5f8f70 : 0x8d5d5a)
        .setAuthor({ name: member.user.username, iconURL: member.user.displayAvatarURL() })
        .setTitle(joined ? "Member joined" : "Member left")
        .setDescription(`${member.user} ${joined ? "joined" : "left"} the server.`)
        .addFields(
          { name: "Member count", value: member.guild.memberCount.toLocaleString(), inline: true },
          { name: "Account created", value: `<t:${Math.floor(member.user.createdTimestamp / 1_000)}:R>`, inline: true },
          { name: "User ID", value: member.id, inline: true },
        )
        .setTimestamp(),
    ],
    allowedMentions: { parse: [] },
  });
}

export async function handleGuildMemberAdd(member: GuildMember, api: OnyxApiClient) {
  try {
    const config = await api.getGuildConfig(member.guild.id);
    const settings = config.settings?.settings;
    if (!settings) return;

    if (config.settings?.enabledModules.includes("welcome")) {
      const channelId = settings.welcome?.channelId ?? settings.welcomeChannelId;
      const channel = await textChannel(member, channelId);
      if (channel) await channel.send(configuredMessage(welcomeTemplate(settings), values(member)));
      if (settings.welcome?.directMessage) await member.send(configuredMessage(welcomeTemplate(settings), values(member))).catch(() => undefined);
    }

    if (config.settings?.enabledModules.includes("autoroles")) {
      const autoroles = settings.autoroles;
      const roleIds = member.user.bot ? autoroles?.botRoleIds ?? [] : autoroles?.memberRoleIds ?? [];
      const accountAgeDays = (Date.now() - member.user.createdTimestamp) / 86_400_000;
      if (roleIds.length && accountAgeDays >= (autoroles?.minimumAccountAgeDays ?? 0)) {
        if ((autoroles?.delaySeconds ?? 0) > 0) {
          await api.scheduleAutoroles({ guildId: member.guild.id, userId: member.id, roleIds, dueAt: new Date(Date.now() + (autoroles?.delaySeconds ?? 0) * 1_000) });
        } else {
          await member.roles.add(roleIds, "Onyx autorole configuration");
        }
      }
    }

    await sendLog(member, api, "join");
  } catch (error) {
    logger.warn({ event: "member.join_handler_failed", guildId: member.guild.id, userId: member.id, error });
  }
}

export async function handleGuildMemberRemove(member: GuildMember | PartialGuildMember, api: OnyxApiClient) {
  try {
    const config = await api.getGuildConfig(member.guild.id);
    const settings = config.settings?.settings;
    if (settings && config.settings?.enabledModules.includes("welcome")) {
      const template = settings.messages?.goodbye ?? { content: "**{username}** left **{server}**. We’re now at **{memberCount}** members." };
      const channel = await textChannel(member, settings.welcome?.goodbyeChannelId);
      if (channel) await channel.send(configuredMessage(template, values(member)));
    }
    await sendLog(member, api, "leave");
  } catch (error) {
    logger.warn({ event: "member.leave_handler_failed", guildId: member.guild.id, userId: member.id, error });
  }
}
