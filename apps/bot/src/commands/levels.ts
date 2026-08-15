import { EmbedBuilder, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { levelProgress } from "@/packages/core/src/leveling";
import type { OnyxCommand } from "./types";

const leaderboard: OnyxCommand = {
  data: new SlashCommandBuilder().setName("leaderboard").setDescription("See the ten members with the most server XP."),
  category: "Levels",
  module: "levels",
  cooldownSeconds: 10,
  async execute({ interaction, api }) {
    await interaction.deferReply();
    const result = await api.getLeaderboard(interaction.guildId);
    if (!result.leaderboard.length) {
      await interaction.editReply("Nobody has earned XP yet. The leaderboard will appear after members start participating.");
      return;
    }
    const medals = ["🥇", "🥈", "🥉"];
    const lines = result.leaderboard.map((profile) => `${medals[profile.rank - 1] ?? `**${profile.rank}.**`} <@${profile.userId}> · **Level ${profile.level}** · ${profile.xp.toLocaleString()} XP`);
    await interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x292a30).setTitle(`${interaction.guild.name} leaderboard`).setDescription(lines.join("\n")).setFooter({ text: "XP is awarded after anti-spam checks" })], allowedMentions: { parse: [] } });
  },
};

const xp: OnyxCommand = {
  data: new SlashCommandBuilder()
    .setName("xp")
    .setDescription("Review or adjust a member's server XP.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((subcommand) => subcommand.setName("get").setDescription("Review a member's current XP and level.").addUserOption((option) => option.setName("member").setDescription("The member to review").setRequired(true)))
    .addSubcommand((subcommand) => subcommand.setName("add").setDescription("Add XP to a member's profile.").addUserOption((option) => option.setName("member").setDescription("The member receiving XP").setRequired(true)).addIntegerOption((option) => option.setName("amount").setDescription("XP to add").setRequired(true).setMinValue(1).setMaxValue(1_000_000)).addStringOption((option) => option.setName("reason").setDescription("Why this XP is being added").setRequired(true).setMaxLength(500)))
    .addSubcommand((subcommand) => subcommand.setName("remove").setDescription("Remove XP without taking the total below zero.").addUserOption((option) => option.setName("member").setDescription("The member losing XP").setRequired(true)).addIntegerOption((option) => option.setName("amount").setDescription("XP to remove").setRequired(true).setMinValue(1).setMaxValue(1_000_000)).addStringOption((option) => option.setName("reason").setDescription("Why this XP is being removed").setRequired(true).setMaxLength(500)))
    .addSubcommand((subcommand) => subcommand.setName("set").setDescription("Set a member's XP to an exact value.").addUserOption((option) => option.setName("member").setDescription("The member to update").setRequired(true)).addIntegerOption((option) => option.setName("amount").setDescription("The new XP total").setRequired(true).setMinValue(0).setMaxValue(2_000_000_000)).addStringOption((option) => option.setName("reason").setDescription("Why this XP is being changed").setRequired(true).setMaxLength(500))),
  category: "Levels",
  module: "levels",
  userPermissions: [PermissionFlagsBits.ManageGuild],
  cooldownSeconds: 2,
  async execute({ interaction, api }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const operation = interaction.options.getSubcommand() as "get" | "add" | "remove" | "set";
    const user = interaction.options.getUser("member", true);
    if (operation === "get") {
      const current = await api.getLevelProfile(interaction.guildId, user.id);
      const progress = levelProgress(current.profile.xp);
      await interaction.editReply(`${user.username} is level **${current.level}** with **${current.profile.xp.toLocaleString()} XP** (rank #${current.profile.rank}, ${progress.percent}% to the next level).`);
      return;
    }
    const result = await api.adjustXp({
      guildId: interaction.guildId,
      userId: user.id,
      moderatorUserId: interaction.user.id,
      operation,
      amount: interaction.options.getInteger("amount", true),
      reason: interaction.options.getString("reason", true).trim(),
    });
    await interaction.editReply(`${user.username} now has **${result.profile.xp.toLocaleString()} XP** and is level **${result.level}**.`);
  },
};

const levelroles: OnyxCommand = {
  data: new SlashCommandBuilder().setName("levelroles").setDescription("Review the role rewards configured for server levels."),
  category: "Levels",
  module: "levels",
  async execute({ interaction, api }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const config = await api.getGuildConfig(interaction.guildId);
    const rewards = [...config.levelRoles].sort((left, right) => left.level - right.level);
    await interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x292a30).setTitle("Level role rewards").setDescription(rewards.length ? rewards.map((reward) => `**Level ${reward.level}** → <@&${reward.roleId}>${reward.stack ? "" : " · replaces earlier rewards"}`).join("\n") : "No level roles are configured yet. An administrator can add them in the dashboard.")] });
  },
};

export const levelCommands: OnyxCommand[] = [leaderboard, xp, levelroles];
