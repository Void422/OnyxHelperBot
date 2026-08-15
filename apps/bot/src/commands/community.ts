import {
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type GuildTextBasedChannel,
} from "discord.js";
import { formatDuration, parseDuration } from "@/packages/core/src/duration";
import { levelProgress } from "@/packages/core/src/leveling";
import type { GiveawayRequirements } from "@/packages/core/src/domain";
import type { GiveawayRecord, OnyxApiClient } from "../api-client";
import { PublicError } from "../errors";
import { sendGuildLog } from "../events/logging";
import { giveawayEmbed, giveawayEntryRow, grantWinnerRoles, winnerAnnouncement } from "../giveaway-events";
import type { OnyxCommand } from "./types";

async function giveawayChannel(interaction: Parameters<OnyxCommand["execute"]>[0]["interaction"], record: GiveawayRecord) {
  const channel = await interaction.guild.channels.fetch(record.channelId).catch(() => null);
  return channel?.isTextBased() && !channel.isDMBased() && "send" in channel ? channel as GuildTextBasedChannel : null;
}

async function refreshGiveawayMessage(interaction: Parameters<OnyxCommand["execute"]>[0]["interaction"], record: GiveawayRecord) {
  if (!record.messageId) return;
  const channel = await giveawayChannel(interaction, record);
  const message = channel ? await channel.messages.fetch(record.messageId).catch(() => null) : null;
  if (message) await message.edit({ embeds: [giveawayEmbed(record, record.status)], components: [giveawayEntryRow(record.id, record.requirements, ["ended", "cancelled"].includes(record.status))] });
}

async function announceWinners(interaction: Parameters<OnyxCommand["execute"]>[0]["interaction"], api: OnyxApiClient, record: GiveawayRecord, reroll = false) {
  const channel = await giveawayChannel(interaction, record);
  if (!channel) return;
  await grantWinnerRoles(interaction.guild, api, record);
  await channel.send(await winnerAnnouncement(interaction.guild, api, record, reroll));
}

const giveaway: OnyxCommand = {
  data: new SlashCommandBuilder()
    .setName("giveaway")
    .setDescription("Run role-gated drops with ticket boosts and winner rewards.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((subcommand) => subcommand.setName("create").setDescription("Start a giveaway in a chosen channel.")
      .addStringOption((option) => option.setName("prize").setDescription("What the winner receives").setRequired(true).setMaxLength(256))
      .addStringOption((option) => option.setName("duration").setDescription("How long entries stay open, such as 2h or 7d").setRequired(true))
      .addIntegerOption((option) => option.setName("winners").setDescription("How many winners to draw").setMinValue(1).setMaxValue(20))
      .addChannelOption((option) => option.setName("channel").setDescription("Where to post it").addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
      .addStringOption((option) => option.setName("description").setDescription("Details entrants should see").setMaxLength(2_000))
      .addRoleOption((option) => option.setName("required_role").setDescription("Only members with this role can enter"))
      .addRoleOption((option) => option.setName("blocked_role").setDescription("Members with this role cannot enter"))
      .addIntegerOption((option) => option.setName("minimum_level").setDescription("Minimum Onyx level to enter").setMinValue(0).setMaxValue(1_000))
      .addIntegerOption((option) => option.setName("account_age").setDescription("Minimum Discord account age in days").setMinValue(0).setMaxValue(3_650))
      .addIntegerOption((option) => option.setName("server_age").setDescription("Minimum days in this server").setMinValue(0).setMaxValue(3_650))
      .addRoleOption((option) => option.setName("bonus_role").setDescription("Role that receives extra draw tickets"))
      .addIntegerOption((option) => option.setName("bonus_tickets").setDescription("Extra tickets for the bonus role").setMinValue(1).setMaxValue(20))
      .addRoleOption((option) => option.setName("winner_role").setDescription("Role awarded to every winner"))
      .addStringOption((option) => option.setName("winner_role_duration").setDescription("How long winners keep the role, such as 7d; omit for permanent")))
    .addSubcommand((subcommand) => subcommand.setName("list").setDescription("List recent giveaways and their IDs."))
    .addSubcommand((subcommand) => subcommand.setName("info").setDescription("Inspect one giveaway.").addStringOption((option) => option.setName("id").setDescription("Giveaway ID from /giveaway list").setRequired(true)))
    .addSubcommand((subcommand) => subcommand.setName("end").setDescription("End a running giveaway and draw winners now.").addStringOption((option) => option.setName("id").setDescription("Giveaway ID").setRequired(true)))
    .addSubcommand((subcommand) => subcommand.setName("reroll").setDescription("Draw replacement winners for an ended giveaway.").addStringOption((option) => option.setName("id").setDescription("Giveaway ID").setRequired(true)))
    .addSubcommand((subcommand) => subcommand.setName("pause").setDescription("Pause entries and preserve the remaining time.").addStringOption((option) => option.setName("id").setDescription("Giveaway ID").setRequired(true)))
    .addSubcommand((subcommand) => subcommand.setName("resume").setDescription("Resume a paused giveaway.").addStringOption((option) => option.setName("id").setDescription("Giveaway ID").setRequired(true)))
    .addSubcommand((subcommand) => subcommand.setName("edit").setDescription("Update a running giveaway.")
      .addStringOption((option) => option.setName("id").setDescription("Giveaway ID").setRequired(true))
      .addStringOption((option) => option.setName("prize").setDescription("New prize").setMaxLength(256))
      .addStringOption((option) => option.setName("description").setDescription("New description").setMaxLength(2_000))
      .addStringOption((option) => option.setName("duration").setDescription("New time remaining, such as 2h or 7d"))
      .addIntegerOption((option) => option.setName("winners").setDescription("New winner count").setMinValue(1).setMaxValue(20))),
  category: "Giveaways",
  module: "giveaways",
  userPermissions: [PermissionFlagsBits.ManageGuild],
  botPermissions: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks],
  cooldownSeconds: 3,
  async execute({ interaction, api }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === "create") {
      const durationMs = parseDuration(interaction.options.getString("duration", true), 365 * 86_400_000);
      if (!durationMs) throw new PublicError("Use a duration like `30m`, `12h`, `7d`, or `2w` (up to one year).");
      const channel = interaction.options.getChannel("channel") ?? interaction.channel;
      if (!channel?.isTextBased() || channel.isDMBased() || !("send" in channel)) throw new PublicError("Choose a server text or announcement channel.");
      const winnerCount = interaction.options.getInteger("winners") ?? 1;
      const prize = interaction.options.getString("prize", true).trim();
      const description = interaction.options.getString("description")?.trim();
      const endsAt = new Date(Date.now() + durationMs);
      const config = await api.getGuildConfig(interaction.guildId, true);
      const defaults = config.settings?.settings.giveaways ?? {};
      const requiredRoleId = interaction.options.getRole("required_role")?.id ?? defaults.requiredRoleId;
      const blockedRoleId = interaction.options.getRole("blocked_role")?.id ?? defaults.blockedRoleId;
      const bonusRoleId = interaction.options.getRole("bonus_role")?.id ?? defaults.bonusRoleId;
      const bonusEntries = interaction.options.getInteger("bonus_tickets") ?? defaults.bonusEntries ?? 1;
      const winnerRoleId = interaction.options.getRole("winner_role")?.id ?? defaults.winnerRoleId;
      const winnerRoleDurationText = interaction.options.getString("winner_role_duration");
      const winnerRoleDurationMs = (winnerRoleDurationText ? parseDuration(winnerRoleDurationText, 365 * 86_400_000) : (defaults.winnerRoleDurationHours ? defaults.winnerRoleDurationHours * 3_600_000 : undefined)) ?? undefined;
      if (winnerRoleDurationText && !winnerRoleDurationMs) throw new PublicError("Use a winner role duration like `12h`, `7d`, or `4w`.");
      if (winnerRoleId) {
        const winnerRole = interaction.guild.roles.cache.get(winnerRoleId);
        if (!winnerRole?.editable) throw new PublicError("Move the Onyx role above the winner role before using it as a reward.");
      }
      const requirements: GiveawayRequirements = {
        requiredRoleIds: requiredRoleId ? [requiredRoleId] : undefined,
        blockedRoleIds: blockedRoleId ? [blockedRoleId] : undefined,
        minimumLevel: interaction.options.getInteger("minimum_level") ?? defaults.minimumLevel,
        minimumAccountAgeDays: interaction.options.getInteger("account_age") ?? defaults.minimumAccountAgeDays,
        minimumMembershipAgeDays: interaction.options.getInteger("server_age") ?? defaults.minimumMembershipAgeDays,
        roleBonusEntries: bonusRoleId ? { [bonusRoleId]: bonusEntries } : undefined,
        winnerRoleId,
        winnerRoleDurationMs,
        accentColor: defaults.accentColor ?? "#e0aa4f",
        entryButtonLabel: defaults.entryButtonLabel ?? "Claim your ticket",
      };
      const created = await api.createGiveaway({ guildId: interaction.guildId, channelId: channel.id, hostUserId: interaction.user.id, prize, description, winnerCount, endsAt, requirements });
      const message = await channel.send({ embeds: [giveawayEmbed({ prize, description, endsAt, winnerCount, hostUserId: interaction.user.id, requirements })], components: [giveawayEntryRow(created.giveaway.id, requirements)] });
      await api.setGiveawayMessage(created.giveaway.id, message.id);
      await sendGuildLog(interaction.guild, api, "giveaways", { embeds: [new EmbedBuilder().setColor(0xe0aa4f).setTitle("Giveaway created").setDescription(`**${prize}** was posted in <#${channel.id}>.`).addFields({ name: "Host", value: `${interaction.user}`, inline: true }, { name: "Ends", value: `<t:${Math.floor(endsAt.getTime() / 1_000)}:R>`, inline: true }).setTimestamp()], allowedMentions: { parse: [] } });
      await interaction.editReply(`🎁 **${prize}** is live in <#${channel.id}> for ${formatDuration(durationMs)}.${winnerRoleId ? ` Winners unlock <@&${winnerRoleId}>.` : ""}\nID: \`${created.giveaway.id}\``);
      return;
    }
    if (subcommand === "list") {
      const result = await api.listGiveaways(interaction.guildId);
      const lines = result.giveaways.map((record) => `**${record.prize}** · ${record.status}\n\`${record.id}\` · <t:${Math.floor(new Date(record.endsAt).getTime() / 1_000)}:R>`);
      await interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x292a30).setTitle("Recent giveaways").setDescription(lines.length ? lines.join("\n\n") : "No giveaways have been created yet.")] });
      return;
    }
    const giveawayId = interaction.options.getString("id", true);
    if (subcommand === "info") {
      const result = await api.getGiveaway(interaction.guildId, giveawayId);
      const record = result.giveaway;
      await interaction.editReply({ embeds: [giveawayEmbed(record, record.status, result.entryCount).addFields(
        { name: "Status", value: record.status, inline: true },
        { name: "ID", value: `\`${record.id}\``, inline: false },
      )] });
      return;
    }
    if (subcommand === "edit") {
      const durationText = interaction.options.getString("duration");
      const durationMs = durationText ? parseDuration(durationText, 365 * 86_400_000) : null;
      if (durationText && !durationMs) throw new PublicError("Use a duration like `30m`, `12h`, `7d`, or `2w` (up to one year).");
      const result = await api.manageGiveaway({
        guildId: interaction.guildId,
        giveawayId,
        actorUserId: interaction.user.id,
        action: "edit",
        prize: interaction.options.getString("prize")?.trim(),
        description: interaction.options.getString("description")?.trim(),
        winnerCount: interaction.options.getInteger("winners") ?? undefined,
        endsAt: durationMs ? new Date(Date.now() + durationMs) : undefined,
      });
      await refreshGiveawayMessage(interaction, result.giveaway);
      await interaction.editReply(`Updated **${result.giveaway.prize}**.`);
      return;
    }
    const action = subcommand as "end" | "reroll" | "pause" | "resume";
    const result = await api.manageGiveaway({ guildId: interaction.guildId, giveawayId, actorUserId: interaction.user.id, action });
    await refreshGiveawayMessage(interaction, result.giveaway);
    if (action === "end" || action === "reroll") await announceWinners(interaction, api, result.giveaway, action === "reroll");
    await sendGuildLog(interaction.guild, api, "giveaways", { embeds: [new EmbedBuilder().setColor(0xe0aa4f).setTitle(`Giveaway ${action}`).setDescription(`**${result.giveaway.prize}** was ${action === "end" ? "ended" : action === "reroll" ? "rerolled" : action === "pause" ? "paused" : "resumed"} by ${interaction.user}.`).setTimestamp()], allowedMentions: { parse: [] } });
    await interaction.editReply(`${action === "end" ? "Ended" : action === "reroll" ? "Rerolled" : action === "pause" ? "Paused" : "Resumed"} **${result.giveaway.prize}**.`);
  },
};

const rank: OnyxCommand = {
  data: new SlashCommandBuilder()
    .setName("rank")
    .setDescription("See a member's level, XP progress, and server rank.")
    .addUserOption((option) => option.setName("member").setDescription("Whose rank to view; defaults to you")),
  category: "Levels",
  module: "levels",
  cooldownSeconds: 3,
  async execute({ interaction, api }) {
    await interaction.deferReply();
    const user = interaction.options.getUser("member") ?? interaction.user;
    const [result, config] = await Promise.all([api.getLevelProfile(interaction.guildId, user.id), api.getGuildConfig(interaction.guildId)]);
    const progress = levelProgress(result.profile.xp, config.settings?.settings.xp?.curve ?? "standard");
    const rewards = [...config.levelRoles].sort((left, right) => left.level - right.level);
    const currentReward = [...rewards].reverse().find((reward) => reward.level <= progress.level);
    const nextReward = rewards.find((reward) => reward.level > progress.level);
    const filled = Math.round(progress.percent / 10);
    const bar = `${"◆".repeat(filled)}${"◇".repeat(10 - filled)}`;
    await interaction.editReply({ embeds: [new EmbedBuilder().setColor(0xe0aa4f).setAuthor({ name: user.globalName ?? user.username, iconURL: user.displayAvatarURL() }).setTitle(`${currentReward ? interaction.guild.roles.cache.get(currentReward.roleId)?.name ?? "Ranked" : "Unranked"} · Level ${progress.level}`).setDescription(`${bar}  **${progress.percent}%**\n${progress.current.toLocaleString()} / ${progress.required.toLocaleString()} XP until level ${progress.level + 1}`).addFields(
      { name: "Server standing", value: `#${result.profile.rank}`, inline: true },
      { name: "Total XP", value: result.profile.xp.toLocaleString(), inline: true },
      { name: "Counted messages", value: result.profile.messageCount.toLocaleString(), inline: true },
      { name: "Next unlock", value: nextReward ? `<@&${nextReward.roleId}> at level **${nextReward.level}**` : rewards.length ? "◆ You reached the top rank" : "No rank ladder configured", inline: false },
    ).setFooter({ text: nextReward ? `${nextReward.level - progress.level} levels to the next rank` : "Keep the crown" })], allowedMentions: { parse: [] } });
  },
};

export const communityCommands: OnyxCommand[] = [giveaway, rank];
