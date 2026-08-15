import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { formatDuration, parseDuration } from "@/packages/core/src/duration";
import { levelProgress } from "@/packages/core/src/leveling";
import { PublicError } from "../errors";
import type { OnyxCommand } from "./types";

const giveaway: OnyxCommand = {
  data: new SlashCommandBuilder()
    .setName("giveaway")
    .setDescription("Create and manage giveaways that survive restarts.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("create")
        .setDescription("Start a giveaway in a chosen channel.")
        .addStringOption((option) => option.setName("prize").setDescription("What the winner receives").setRequired(true).setMaxLength(256))
        .addStringOption((option) => option.setName("duration").setDescription("How long entries stay open, such as 2h or 7d").setRequired(true))
        .addIntegerOption((option) => option.setName("winners").setDescription("How many winners to draw").setMinValue(1).setMaxValue(20))
        .addChannelOption((option) => option.setName("channel").setDescription("Where to post it").addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
        .addStringOption((option) => option.setName("description").setDescription("Optional details for entrants").setMaxLength(2_000)),
    ),
  category: "Community",
  module: "giveaways",
  userPermissions: [PermissionFlagsBits.ManageGuild],
  botPermissions: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks],
  cooldownSeconds: 5,
  async execute({ interaction, api }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const durationMs = parseDuration(interaction.options.getString("duration", true), 365 * 86_400_000);
    if (!durationMs) throw new PublicError("Use a duration like `30m`, `12h`, `7d`, or `2w` (up to one year).");
    const channel = interaction.options.getChannel("channel") ?? interaction.channel;
    if (!channel?.isTextBased() || channel.isDMBased() || !("send" in channel)) throw new PublicError("Choose a server text or announcement channel.");
    const winnerCount = interaction.options.getInteger("winners") ?? 1;
    const prize = interaction.options.getString("prize", true).trim();
    const description = interaction.options.getString("description")?.trim();
    const endsAt = new Date(Date.now() + durationMs);
    const created = await api.createGiveaway({
      guildId: interaction.guildId,
      channelId: channel.id,
      hostUserId: interaction.user.id,
      prize,
      description,
      winnerCount,
      endsAt,
    });
    const embed = new EmbedBuilder()
      .setColor(0x202225)
      .setTitle(prize)
      .setDescription(description || "Use the button below to enter. I'll check eligibility again before drawing the winners.")
      .addFields(
        { name: "Ends", value: `<t:${Math.floor(endsAt.getTime() / 1_000)}:R>`, inline: true },
        { name: "Winners", value: String(winnerCount), inline: true },
        { name: "Hosted by", value: `<@${interaction.user.id}>`, inline: true },
      )
      .setFooter({ text: "Entries are selected server-side" })
      .setTimestamp(endsAt);
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`giveaway:enter:${created.giveaway.id}`).setLabel("Enter giveaway").setStyle(ButtonStyle.Secondary),
    );
    const message = await channel.send({ embeds: [embed], components: [row] });
    await api.setGiveawayMessage(created.giveaway.id, message.id);
    await interaction.editReply(`Giveaway posted in <#${channel.id}>. Entries close in ${formatDuration(durationMs)}.`);
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
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x2b2d31)
          .setAuthor({ name: user.globalName ?? user.username, iconURL: user.displayAvatarURL() })
          .setTitle(`Level ${progress.level} · Rank #${result.profile.rank}`)
          .setDescription(`${bar}  **${progress.percent}%**\n${progress.current.toLocaleString()} / ${progress.required.toLocaleString()} XP to the next level`)
          .addFields(
            { name: "Total XP", value: result.profile.xp.toLocaleString(), inline: true },
            { name: "Counted messages", value: result.profile.messageCount.toLocaleString(), inline: true },
          ),
      ],
    });
  },
};

export const communityCommands: OnyxCommand[] = [giveaway, rank];
