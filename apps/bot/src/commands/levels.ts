import { EmbedBuilder, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { levelProgress } from "@/packages/core/src/leveling";
import { getRankLadderPreset, rankLadderPresets, type RankPermissionKey } from "@/packages/core/src/rank-ladders";
import { PublicError } from "../errors";
import type { OnyxCommand } from "./types";

const rankPermissionBits: Record<RankPermissionKey, bigint> = {
  AddReactions: PermissionFlagsBits.AddReactions,
  EmbedLinks: PermissionFlagsBits.EmbedLinks,
  AttachFiles: PermissionFlagsBits.AttachFiles,
  UseExternalEmojis: PermissionFlagsBits.UseExternalEmojis,
  CreatePublicThreads: PermissionFlagsBits.CreatePublicThreads,
  SendMessagesInThreads: PermissionFlagsBits.SendMessagesInThreads,
  UseExternalStickers: PermissionFlagsBits.UseExternalStickers,
};

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
    await interaction.editReply({ embeds: [new EmbedBuilder().setColor(0xe0aa4f).setTitle(`🏆 ${interaction.guild.name} rankings`).setDescription(lines.join("\n")).setFooter({ text: "Keep talking. Every rank has a role waiting." })], allowedMentions: { parse: [] } });
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
      const config = await api.getGuildConfig(interaction.guildId);
      const progress = levelProgress(current.profile.xp, config.settings?.settings.xp?.curve ?? "standard");
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
  data: new SlashCommandBuilder()
    .setName("levelroles")
    .setDescription("Build or review the server's rank ladder.")
    .addSubcommand((subcommand) => subcommand.setName("list").setDescription("See every rank, level, and unlocked role."))
    .addSubcommand((subcommand) => subcommand.setName("setup").setDescription("Create a complete seven-role rank ladder.")
      .addStringOption((option) => option.setName("preset").setDescription("How hard members should have to grind").setRequired(true).addChoices(
        ...rankLadderPresets.map((preset) => ({ name: `${preset.name} — ${preset.tiers.at(-1)?.level} levels`, value: preset.id })),
      ))
      .addBooleanOption((option) => option.setName("replace").setDescription("Replace the current reward mapping; old Discord roles stay untouched"))),
  category: "Levels",
  module: "levels",
  async execute({ interaction, api }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const subcommand = interaction.options.getSubcommand();
    const config = await api.getGuildConfig(interaction.guildId, subcommand === "setup");
    const rewards = [...config.levelRoles].sort((left, right) => left.level - right.level);
    if (subcommand === "list") {
      const curve = config.settings?.settings.xp?.curve ?? "standard";
      await interaction.editReply({ embeds: [new EmbedBuilder().setColor(0xe0aa4f).setTitle("Your rank ladder").setDescription(rewards.length ? rewards.map((reward, index) => `${index === rewards.length - 1 ? "◆" : "◇"} **Level ${reward.level}** → <@&${reward.roleId}>${reward.stack ? " · stacks" : ""}`).join("\n") : "No ladder yet. Use `/levelroles setup` to create all seven roles at once.").setFooter({ text: `${curve === "legendary" ? "Legend" : curve === "grind" ? "The Grind" : "Momentum"} XP curve` })] });
      return;
    }
    if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageRoles)) throw new PublicError("You need Manage Roles to create a rank ladder.");
    if (!interaction.appPermissions?.has(PermissionFlagsBits.ManageRoles)) throw new PublicError("Give Onyx Manage Roles and move its role above the new ranks first.");
    const replace = interaction.options.getBoolean("replace") ?? false;
    if (rewards.length && !replace) throw new PublicError("This server already has rank rewards. Run setup again with `replace: True` to build a new ladder.");
    const preset = getRankLadderPreset(interaction.options.getString("preset", true) as "momentum" | "grind" | "legend");
    const created = [];
    try {
      for (const tier of preset.tiers) {
        const role = await interaction.guild.roles.create({
          name: `Rank • ${tier.name}`,
          color: tier.color,
          hoist: Boolean(tier.hoist),
          mentionable: false,
          permissions: tier.permissions.map((permission) => rankPermissionBits[permission]),
          reason: `${interaction.user.username} created the Onyx ${preset.name} ladder`,
        });
        created.push({ tier, role });
      }
      await api.configureLevelRoles({ guildId: interaction.guildId, actorUserId: interaction.user.id, curve: preset.curve, rewards: created.map(({ tier, role }) => ({ level: tier.level, roleId: role.id, stack: false })) });
    } catch (error) {
      await Promise.all(created.map(({ role }) => role.delete("Rolling back an incomplete Onyx rank ladder").catch(() => undefined)));
      throw error;
    }
    await interaction.editReply({ embeds: [new EmbedBuilder().setColor(0xe0aa4f).setTitle(`◆ ${preset.name} ladder created`).setDescription(created.map(({ tier, role }) => `**Level ${tier.level}** → ${role} · ${tier.perks.join(", ")}`).join("\n")).setFooter({ text: `${created.length} roles created · members keep only their highest rank` })] });
  },
};

export const levelCommands: OnyxCommand[] = [leaderboard, xp, levelroles];
