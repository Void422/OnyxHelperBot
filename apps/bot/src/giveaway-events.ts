import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, type Guild, type MessageCreateOptions } from "discord.js";
import { formatDuration } from "@/packages/core/src/duration";
import type { GiveawayRequirements } from "@/packages/core/src/domain";
import type { EndedGiveaway, GiveawayRecord, OnyxApiClient } from "./api-client";
import { logger } from "./logger";
import { configuredMessage } from "./messages";

interface GiveawayView {
  prize: string;
  description?: string | null;
  endsAt: Date | string;
  winnerCount: number;
  hostUserId: string;
  requirements: GiveawayRequirements;
  eligibleEntryCount?: number | null;
}
type GiveawayResult = GiveawayRecord | EndedGiveaway;

function color(requirements: GiveawayRequirements, status: string) {
  if (status === "paused") return 0x8d7046;
  if (status === "ended" || status === "cancelled") return 0x505057;
  const parsed = Number.parseInt((requirements.accentColor ?? "#e0aa4f").replace("#", ""), 16);
  return Number.isFinite(parsed) ? parsed : 0xe0aa4f;
}

function entryRules(requirements: GiveawayRequirements) {
  const rules: string[] = [];
  if (requirements.requiredRoleIds?.length) rules.push(`Role: ${requirements.requiredRoleIds.map((id) => `<@&${id}>`).join(" or ")}`);
  if (requirements.minimumLevel) rules.push(`Level ${requirements.minimumLevel}+`);
  if (requirements.minimumAccountAgeDays) rules.push(`${requirements.minimumAccountAgeDays}d Discord account`);
  if (requirements.minimumMembershipAgeDays) rules.push(`${requirements.minimumMembershipAgeDays}d in server`);
  return rules.length ? rules.join(" · ") : "Open to everyone";
}

function boosts(requirements: GiveawayRequirements) {
  const entries = Object.entries(requirements.roleBonusEntries ?? {});
  return entries.length ? entries.map(([roleId, bonus]) => `<@&${roleId}> gets **+${bonus}** ticket${bonus === 1 ? "" : "s"}`).join("\n") : "One ticket per member";
}

export function giveawayEmbed(record: GiveawayView, status = "active", entryCount = record.eligibleEntryCount ?? 0) {
  const endsAt = new Date(record.endsAt);
  const fields = [
    { name: status === "ended" ? "Draw closed" : status === "paused" ? "Clock paused" : "Draws", value: `<t:${Math.floor(endsAt.getTime() / 1_000)}:R>`, inline: true },
    { name: "Winners", value: String(record.winnerCount), inline: true },
    { name: "Entrants", value: entryCount.toLocaleString(), inline: true },
    { name: "Entry rules", value: entryRules(record.requirements), inline: false },
    { name: "Ticket boosts", value: boosts(record.requirements), inline: false },
  ];
  if (record.requirements.winnerRoleId) {
    fields.push({ name: "Winner unlock", value: `<@&${record.requirements.winnerRoleId}>${record.requirements.winnerRoleDurationMs ? ` for ${formatDuration(record.requirements.winnerRoleDurationMs)}` : ""}`, inline: false });
  }
  return new EmbedBuilder()
    .setColor(color(record.requirements, status))
    .setAuthor({ name: status === "ended" ? "ONYX DRAW COMPLETE" : "ONYX GIVEAWAY DROP" })
    .setTitle(`🎁 ${record.prize}`)
    .setDescription(record.description || "Claim a ticket below. Boost roles add extra chances automatically.")
    .addFields(fields)
    .setFooter({ text: status === "paused" ? "Entries are paused" : status === "ended" ? "The draw is closed" : "Tap once to lock in your tickets" })
    .setTimestamp(endsAt);
}

export function giveawayEntryRow(giveawayId: string, requirements: GiveawayRequirements = {}, disabled = false) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`giveaway:enter:${giveawayId}`)
      .setEmoji(disabled ? "🔒" : "🎟️")
      .setLabel(disabled ? "Draw closed" : (requirements.entryButtonLabel ?? "Claim your ticket"))
      .setStyle(disabled ? ButtonStyle.Secondary : ButtonStyle.Primary)
      .setDisabled(disabled),
  );
}

export async function grantWinnerRoles(guild: Guild, api: OnyxApiClient, giveaway: GiveawayResult) {
  const roleId = giveaway.requirements.winnerRoleId;
  if (!roleId || !giveaway.winnerUserIds.length) return 0;
  const role = await guild.roles.fetch(roleId).catch(() => null);
  if (!role?.editable) {
    logger.warn({ event: "giveaway.winner_role_unavailable", guildId: guild.id, giveawayId: giveaway.id, roleId });
    return 0;
  }
  let granted = 0;
  for (const userId of giveaway.winnerUserIds) {
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) continue;
    const added = await member.roles.add(role, `Won ${giveaway.prize}`).then(() => true).catch((error) => {
      logger.warn({ event: "giveaway.winner_role_failed", guildId: guild.id, giveawayId: giveaway.id, userId, roleId, error });
      return false;
    });
    if (!added) continue;
    granted += 1;
    if (giveaway.requirements.winnerRoleDurationMs) {
      await api.scheduleWinnerRoleRemoval({ guildId: guild.id, userId, roleId, dueAt: new Date(Date.now() + giveaway.requirements.winnerRoleDurationMs) }).catch((error) => logger.warn({ event: "giveaway.winner_role_expiry_failed", giveawayId: giveaway.id, userId, roleId, error }));
    }
  }
  return granted;
}

export async function winnerAnnouncement(guild: Guild, api: OnyxApiClient, giveaway: GiveawayResult, reroll = false): Promise<MessageCreateOptions> {
  const winners = giveaway.winnerUserIds.map((id) => `<@${id}>`);
  const config = await api.getGuildConfig(guild.id, true);
  const template = config.settings?.settings.messages?.giveawayWinner;
  const customized = template && winners.length ? configuredMessage(template, { user: giveaway.winnerUserIds[0], mention: winners.join(", "), username: winners.join(", "), server: guild.name, prize: giveaway.prize }) : null;
  const winnerRole = giveaway.requirements.winnerRoleId ? `<@&${giveaway.requirements.winnerRoleId}>${giveaway.requirements.winnerRoleDurationMs ? ` · ${formatDuration(giveaway.requirements.winnerRoleDurationMs)}` : ""}` : "Prize only";
  const celebration = new EmbedBuilder()
    .setColor(color(giveaway.requirements, "active"))
    .setAuthor({ name: reroll ? "ONYX REROLL" : "ONYX WINNER REVEAL" })
    .setTitle(winners.length ? "🏆 The draw has spoken" : "Draw closed")
    .setDescription(winners.length ? `${winners.join(", ")} ${winners.length === 1 ? "takes" : "take"} **${giveaway.prize}**.\n\nThat winner glow is yours. Enjoy it.` : `Nobody qualified for **${giveaway.prize}** this time.`)
    .addFields(
      { name: "Prize", value: giveaway.prize, inline: true },
      { name: "Winner unlock", value: winnerRole, inline: true },
      { name: "Verified entrants", value: String(giveaway.eligibleEntryCount ?? 0), inline: true },
    )
    .setThumbnail(guild.iconURL({ size: 256 }))
    .setFooter({ text: reroll ? "Replacement winners selected" : "GG — make some noise for the winners" })
    .setTimestamp();
  return {
    content: customized?.content ?? (winners.length ? `✨ ${winners.join(", ")} — you just won **${giveaway.prize}**!` : undefined),
    embeds: customized?.embeds?.length ? customized.embeds : [celebration],
    allowedMentions: { users: giveaway.winnerUserIds, roles: giveaway.requirements.winnerRoleId ? [giveaway.requirements.winnerRoleId] : [], parse: [] },
  };
}
