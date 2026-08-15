import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type GuildTextBasedChannel,
} from "discord.js";
import { formatDuration, parseDuration } from "@/packages/core/src/duration";
import { levelProgress } from "@/packages/core/src/leveling";
import type { GiveawayRecord, OnyxApiClient } from "../api-client";
import { PublicError } from "../errors";
import { sendGuildLog } from "../events/logging";
import { configuredMessage } from "../messages";
import type { OnyxCommand } from "./types";

function giveawayEmbed(record: GiveawayRecord | { prize: string; description?: string | null; endsAt: Date | string; winnerCount: number; hostUserId: string }, status = "active") {
  const endsAt = new Date(record.endsAt);
  return new EmbedBuilder()
    .setColor(status === "paused" ? 0x8d7046 : status === "ended" ? 0x4c4d52 : 0x24252a)
    .setTitle(record.prize)
    .setDescription(record.description || "Use the button below to enter. Eligibility is checked again before winners are drawn.")
    .addFields(
      { name: status === "ended" ? "Ended" : status === "paused" ? "Original end" : "Ends", value: `<t:${Math.floor(endsAt.getTime() / 1_000)}:R>`, inline: true },
      { name: "Winners", value: String(record.winnerCount), inline: true },
      { name: "Hosted by", value: `<@${record.hostUserId}>`, inline: true },
    )
    .setFooter({ text: status === "paused" ? "Entries are paused" : status === "ended" ? "Giveaway ended" : "Entries and winner selection are stored server-side" })
    .setTimestamp(endsAt);
}

function entryRow(giveawayId: string, disabled = false) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`giveaway:enter:${giveawayId}`).setLabel(disabled ? "Giveaway closed" : "Enter giveaway").setStyle(ButtonStyle.Secondary).setDisabled(disabled),
  );
}

async function giveawayChannel(interaction: Parameters<OnyxCommand["execute"]>[0]["interaction"], record: GiveawayRecord) {
  const channel = await interaction.guild.channels.fetch(record.channelId).catch(() => null);
  return channel?.isTextBased() && !channel.isDMBased() && "send" in channel ? channel as GuildTextBasedChannel : null;
}

async function refreshGiveawayMessage(interaction: Parameters<OnyxCommand["execute"]>[0]["interaction"], record: GiveawayRecord) {
  if (!record.messageId) return;
  const channel = await giveawayChannel(interaction, record);
  const message = channel ? await channel.messages.fetch(record.messageId).catch(() => null) : null;
  if (message) await message.edit({ embeds: [giveawayEmbed(record, record.status)], components: [entryRow(record.id, ["ended", "cancelled"].includes(record.status))] });
}

async function announceWinners(interaction: Parameters<OnyxCommand["execute"]>[0]["interaction"], api: OnyxApiClient, record: GiveawayRecord, reroll = false) {
  const channel = await giveawayChannel(interaction, record);
  if (!channel) return;
  const winners = record.winnerUserIds.map((id) => `<@${id}>`);
  const config = await api.getGuildConfig(interaction.guildId, true);
  const template = config.settings?.settings.messages?.giveawayWinner;
  const message = template && winners.length
    ? configuredMessage(template, { user: record.winnerUserIds[0], mention: winners.join(", "), username: winners.join(", "), server: interaction.guild.name, prize: record.prize })
    : { content: winners.length ? `${reroll ? "Giveaway rerolled" : "Giveaway ended"} — ${winners.join(", ")} ${winners.length === 1 ? "wins" : "win"} **${record.prize}**.` : `Giveaway ended — there were no eligible entries for **${record.prize}**.` };
  await channel.send({ ...message, allowedMentions: { users: record.winnerUserIds, parse: [] } });
}

const giveaway: OnyxCommand = {
  data: new SlashCommandBuilder()
    .setName("giveaway")
    .setDescription("Create and manage giveaways that survive restarts.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((subcommand) => subcommand.setName("create").setDescription("Start a giveaway in a chosen channel.")
      .addStringOption((option) => option.setName("prize").setDescription("What the winner receives").setRequired(true).setMaxLength(256))
      .addStringOption((option) => option.setName("duration").setDescription("How long entries stay open, such as 2h or 7d").setRequired(true))
      .addIntegerOption((option) => option.setName("winners").setDescription("How many winners to draw").setMinValue(1).setMaxValue(20))
      .addChannelOption((option) => option.setName("channel").setDescription("Where to post it").addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
      .addStringOption((option) => option.setName("description").setDescription("Optional details for entrants").setMaxLength(2_000)))
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
      const created = await api.createGiveaway({ guildId: interaction.guildId, channelId: channel.id, hostUserId: interaction.user.id, prize, description, winnerCount, endsAt });
      const message = await channel.send({ embeds: [giveawayEmbed({ prize, description, endsAt, winnerCount, hostUserId: interaction.user.id })], components: [entryRow(created.giveaway.id)] });
      await api.setGiveawayMessage(created.giveaway.id, message.id);
      await sendGuildLog(interaction.guild, api, "giveaways", { embeds: [new EmbedBuilder().setColor(0xe0aa4f).setTitle("Giveaway created").setDescription(`**${prize}** was posted in <#${channel.id}>.`).addFields({ name: "Host", value: `${interaction.user}`, inline: true }, { name: "Ends", value: `<t:${Math.floor(endsAt.getTime() / 1_000)}:R>`, inline: true }).setTimestamp()], allowedMentions: { parse: [] } });
      await interaction.editReply(`Giveaway posted in <#${channel.id}>. Entries close in ${formatDuration(durationMs)}. ID: \`${created.giveaway.id}\``);
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
      await interaction.editReply({ embeds: [giveawayEmbed(record, record.status).addFields(
        { name: "Entries", value: result.entryCount.toLocaleString(), inline: true },
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
    const result = await api.getLevelProfile(interaction.guildId, user.id);
    const progress = levelProgress(result.profile.xp);
    const filled = Math.round(progress.percent / 10);
    const bar = `${"■".repeat(filled)}${"□".repeat(10 - filled)}`;
    await interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x2b2d31).setAuthor({ name: user.globalName ?? user.username, iconURL: user.displayAvatarURL() }).setTitle(`Level ${progress.level} · Rank #${result.profile.rank}`).setDescription(`${bar}  **${progress.percent}%**\n${progress.current.toLocaleString()} / ${progress.required.toLocaleString()} XP to the next level`).addFields(
      { name: "Total XP", value: result.profile.xp.toLocaleString(), inline: true },
      { name: "Counted messages", value: result.profile.messageCount.toLocaleString(), inline: true },
    )] });
  },
};

export const communityCommands: OnyxCommand[] = [giveaway, rank];
