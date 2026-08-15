import {
  EmbedBuilder,
  GuildMember,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type User,
} from "discord.js";
import { checkModerationHierarchy } from "@/packages/core/src/permissions";
import { formatDuration, parseDuration } from "@/packages/core/src/duration";
import { PublicError } from "../errors";
import type { OnyxCommand } from "./types";

function reason(interaction: ChatInputCommandInteraction) {
  return interaction.options.getString("reason")?.trim() || "No reason was provided.";
}

async function targetMember(interaction: ChatInputCommandInteraction<"cached">, user: User) {
  return interaction.guild.members.fetch(user.id).catch(() => null);
}

function assertHierarchy(interaction: ChatInputCommandInteraction<"cached">, target: GuildMember) {
  const actor = interaction.member;
  const bot = interaction.guild.members.me;
  if (!bot) throw new PublicError("Onyx could not confirm its role in this server.");
  const result = checkModerationHierarchy({
    guildOwnerId: interaction.guild.ownerId,
    actor: { id: actor.id, highestRolePosition: actor.roles.highest.position },
    target: { id: target.id, highestRolePosition: target.roles.highest.position },
    bot: { id: bot.id, highestRolePosition: bot.roles.highest.position },
  });
  if (!result.allowed) throw new PublicError(result.reason);
}

async function replyCase(interaction: ChatInputCommandInteraction<"cached">, message: string, caseNumber: number) {
  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x2f3136)
        .setTitle(message)
        .setDescription(`Recorded as case **#${caseNumber}**.`)
        .setTimestamp(),
    ],
  });
}

const ban: OnyxCommand = {
  data: new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Remove a member from the server, permanently or for a set time.")
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption((option) => option.setName("member").setDescription("The member to ban").setRequired(true))
    .addStringOption((option) => option.setName("duration").setDescription("Optional duration, such as 12h or 7d"))
    .addStringOption((option) => option.setName("reason").setDescription("Why this member is being banned").setMaxLength(1_000))
    .addIntegerOption((option) => option.setName("delete_days").setDescription("Days of recent messages to delete").setMinValue(0).setMaxValue(7)),
  category: "Moderation",
  module: "moderation",
  userPermissions: [PermissionFlagsBits.BanMembers],
  botPermissions: [PermissionFlagsBits.BanMembers],
  cooldownSeconds: 3,
  async execute({ interaction, api }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const user = interaction.options.getUser("member", true);
    const member = await targetMember(interaction, user);
    if (member) assertHierarchy(interaction, member);
    const durationText = interaction.options.getString("duration");
    const durationMs = durationText ? parseDuration(durationText, 365 * 86_400_000) : null;
    if (durationText && !durationMs) throw new PublicError("Use a duration like `30m`, `12h`, `7d`, or `2w` (up to one year).");
    const moderationReason = reason(interaction);
    await interaction.guild.members.ban(user.id, {
      reason: `${moderationReason} — ${interaction.user.username}`.slice(0, 512),
      deleteMessageSeconds: (interaction.options.getInteger("delete_days") ?? 0) * 86_400,
    });
    const record = await api.createCase({
      guildId: interaction.guildId,
      targetUserId: user.id,
      moderatorUserId: interaction.user.id,
      action: durationMs ? "tempban" : "ban",
      reason: moderationReason,
      durationMs: durationMs ?? undefined,
      expiresAt: durationMs ? new Date(Date.now() + durationMs) : undefined,
    });
    await replyCase(interaction, `${user.username} was ${durationMs ? `banned for ${formatDuration(durationMs)}` : "banned"}.`, record.case.caseNumber);
  },
};

const unban: OnyxCommand = {
  data: new SlashCommandBuilder()
    .setName("unban")
    .setDescription("Lift a member's ban using their Discord user ID.")
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addStringOption((option) => option.setName("user_id").setDescription("The banned user's Discord ID").setRequired(true))
    .addStringOption((option) => option.setName("reason").setDescription("Why the ban is being lifted").setMaxLength(1_000)),
  category: "Moderation",
  module: "moderation",
  userPermissions: [PermissionFlagsBits.BanMembers],
  botPermissions: [PermissionFlagsBits.BanMembers],
  async execute({ interaction, api }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const userId = interaction.options.getString("user_id", true).trim();
    if (!/^\d{17,20}$/.test(userId)) throw new PublicError("That does not look like a Discord user ID.");
    const moderationReason = reason(interaction);
    const user = await interaction.guild.bans.remove(userId, `${moderationReason} — ${interaction.user.username}`).catch(() => null);
    if (!user) throw new PublicError("I could not find an active ban for that user.");
    const record = await api.createCase({ guildId: interaction.guildId, targetUserId: userId, moderatorUserId: interaction.user.id, action: "unban", reason: moderationReason });
    await replyCase(interaction, `${user.username}'s ban was lifted.`, record.case.caseNumber);
  },
};

const kick: OnyxCommand = {
  data: new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Remove a member without preventing them from coming back.")
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption((option) => option.setName("member").setDescription("The member to remove").setRequired(true))
    .addStringOption((option) => option.setName("reason").setDescription("Why this member is being removed").setMaxLength(1_000)),
  category: "Moderation",
  module: "moderation",
  userPermissions: [PermissionFlagsBits.KickMembers],
  botPermissions: [PermissionFlagsBits.KickMembers],
  cooldownSeconds: 3,
  async execute({ interaction, api }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const user = interaction.options.getUser("member", true);
    const member = await targetMember(interaction, user);
    if (!member) throw new PublicError("That member is no longer in the server.");
    assertHierarchy(interaction, member);
    const moderationReason = reason(interaction);
    await member.kick(`${moderationReason} — ${interaction.user.username}`);
    const record = await api.createCase({ guildId: interaction.guildId, targetUserId: user.id, moderatorUserId: interaction.user.id, action: "kick", reason: moderationReason });
    await replyCase(interaction, `${user.username} was removed from the server.`, record.case.caseNumber);
  },
};

const timeout: OnyxCommand = {
  data: new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("Pause a member's ability to participate for up to 28 days.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) => option.setName("member").setDescription("The member to time out").setRequired(true))
    .addStringOption((option) => option.setName("duration").setDescription("How long, such as 30m, 12h, or 7d").setRequired(true))
    .addStringOption((option) => option.setName("reason").setDescription("Why this member is being timed out").setMaxLength(1_000)),
  category: "Moderation",
  module: "moderation",
  userPermissions: [PermissionFlagsBits.ModerateMembers],
  botPermissions: [PermissionFlagsBits.ModerateMembers],
  cooldownSeconds: 3,
  async execute({ interaction, api }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const user = interaction.options.getUser("member", true);
    const member = await targetMember(interaction, user);
    if (!member) throw new PublicError("That member is no longer in the server.");
    assertHierarchy(interaction, member);
    const durationMs = parseDuration(interaction.options.getString("duration", true));
    if (!durationMs) throw new PublicError("Use a duration like `30m`, `12h`, or `7d` (up to 28 days).");
    const moderationReason = reason(interaction);
    await member.timeout(durationMs, `${moderationReason} — ${interaction.user.username}`);
    const record = await api.createCase({
      guildId: interaction.guildId,
      targetUserId: user.id,
      moderatorUserId: interaction.user.id,
      action: "timeout",
      reason: moderationReason,
      durationMs,
      expiresAt: new Date(Date.now() + durationMs),
    });
    await replyCase(interaction, `${user.username} was timed out for ${formatDuration(durationMs)}.`, record.case.caseNumber);
  },
};

const untimeout: OnyxCommand = {
  data: new SlashCommandBuilder()
    .setName("untimeout")
    .setDescription("Let a timed-out member participate again.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) => option.setName("member").setDescription("The member whose timeout should end").setRequired(true))
    .addStringOption((option) => option.setName("reason").setDescription("Why the timeout is ending early").setMaxLength(1_000)),
  category: "Moderation",
  module: "moderation",
  userPermissions: [PermissionFlagsBits.ModerateMembers],
  botPermissions: [PermissionFlagsBits.ModerateMembers],
  async execute({ interaction, api }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const user = interaction.options.getUser("member", true);
    const member = await targetMember(interaction, user);
    if (!member) throw new PublicError("That member is no longer in the server.");
    assertHierarchy(interaction, member);
    const moderationReason = reason(interaction);
    await member.timeout(null, `${moderationReason} — ${interaction.user.username}`);
    const record = await api.createCase({ guildId: interaction.guildId, targetUserId: user.id, moderatorUserId: interaction.user.id, action: "untimeout", reason: moderationReason });
    await replyCase(interaction, `${user.username}'s timeout was removed.`, record.case.caseNumber);
  },
};

const warn: OnyxCommand = {
  data: new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Add a persistent warning to a member's moderation history.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) => option.setName("member").setDescription("The member to warn").setRequired(true))
    .addStringOption((option) => option.setName("reason").setDescription("What the member needs to correct").setRequired(true).setMaxLength(1_000)),
  category: "Moderation",
  module: "moderation",
  userPermissions: [PermissionFlagsBits.ModerateMembers],
  cooldownSeconds: 2,
  async execute({ interaction, api }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const user = interaction.options.getUser("member", true);
    const member = await targetMember(interaction, user);
    if (!member) throw new PublicError("That member is no longer in the server.");
    assertHierarchy(interaction, member);
    const moderationReason = reason(interaction);
    const result = await api.warn({ guildId: interaction.guildId, userId: user.id, moderatorUserId: interaction.user.id, reason: moderationReason });
    let escalation = "";
    const guildConfig = await api.getGuildConfig(interaction.guildId, true);
    const threshold = guildConfig.settings?.settings.warningThresholds?.find((item) => item.count === result.activeCount);
    if (threshold) {
      try {
        if (threshold.action === "timeout" && threshold.durationMs) await member.timeout(threshold.durationMs, `Warning threshold reached (${result.activeCount})`);
        if (threshold.action === "kick") await member.kick(`Warning threshold reached (${result.activeCount})`);
        if (threshold.action === "ban") await member.ban({ reason: `Warning threshold reached (${result.activeCount})` });
        await api.createCase({
          guildId: interaction.guildId,
          targetUserId: user.id,
          moderatorUserId: interaction.client.user.id,
          action: `warning_${threshold.action}`,
          reason: `Automatic escalation after ${result.activeCount} active warnings.`,
          durationMs: threshold.durationMs,
          expiresAt: threshold.durationMs ? new Date(Date.now() + threshold.durationMs) : undefined,
          automated: true,
        });
        escalation = ` The configured ${threshold.action} threshold was also applied.`;
      } catch {
        escalation = " The warning was saved, but I could not apply the configured escalation; check my role and permissions.";
      }
    }
    await interaction.editReply(`Warning #${result.warning.caseNumber} was added for ${user.username}. They now have ${result.activeCount} active warning${result.activeCount === 1 ? "" : "s"}.${escalation}`);
  },
};

const warningsCommand: OnyxCommand = {
  data: new SlashCommandBuilder()
    .setName("warnings")
    .setDescription("Review a member's active warnings.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) => option.setName("member").setDescription("The member whose warnings you want to review").setRequired(true)),
  category: "Moderation",
  module: "moderation",
  userPermissions: [PermissionFlagsBits.ModerateMembers],
  async execute({ interaction, api }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const user = interaction.options.getUser("member", true);
    const result = await api.getWarnings(interaction.guildId, user.id);
    if (!result.warnings.length) {
      await interaction.editReply(`No active warnings found for ${user.username}.`);
      return;
    }
    const lines = result.warnings.slice(0, 10).map((warning, index) => `**${index + 1}.** ${warning.reason}\n<t:${Math.floor(new Date(warning.createdAt).getTime() / 1_000)}:R> · by <@${warning.moderatorUserId}>`);
    await interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x3b3d42).setTitle(`Warnings for ${user.username}`).setDescription(lines.join("\n\n")).setFooter({ text: `${result.warnings.length} active warning${result.warnings.length === 1 ? "" : "s"}` })] });
  },
};

const purge: OnyxCommand = {
  data: new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Remove a batch of recent messages from this channel.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption((option) => option.setName("count").setDescription("How many messages to check").setRequired(true).setMinValue(1).setMaxValue(100))
    .addUserOption((option) => option.setName("member").setDescription("Only remove messages from this member"))
    .addStringOption((option) => option.setName("contains").setDescription("Only remove messages containing this text").setMinLength(1).setMaxLength(100)),
  category: "Moderation",
  module: "moderation",
  userPermissions: [PermissionFlagsBits.ManageMessages],
  botPermissions: [PermissionFlagsBits.ManageMessages],
  cooldownSeconds: 5,
  async execute({ interaction, api }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const channel = interaction.channel;
    if (!channel || !("messages" in channel) || !("bulkDelete" in channel)) throw new PublicError("Messages cannot be purged in this channel.");
    const count = interaction.options.getInteger("count", true);
    const user = interaction.options.getUser("member");
    const contains = interaction.options.getString("contains")?.toLocaleLowerCase();
    const fetched = await channel.messages.fetch({ limit: Math.min(100, count + 10) });
    const selected = fetched.filter((message) => (!user || message.author.id === user.id) && (!contains || message.content.toLocaleLowerCase().includes(contains))).first(count);
    const deleted = await channel.bulkDelete(selected, true);
    const moderationReason = `Purged ${deleted.size} message${deleted.size === 1 ? "" : "s"} in #${"name" in channel ? channel.name : "channel"}.`;
    const record = await api.createCase({
      guildId: interaction.guildId,
      targetUserId: user?.id ?? interaction.user.id,
      moderatorUserId: interaction.user.id,
      action: "purge",
      reason: moderationReason,
      relatedChannelId: interaction.channelId,
    });
    await interaction.editReply(`${moderationReason} Case #${record.case.caseNumber}. Messages older than 14 days were left alone.`);
  },
};

function channelControl(name: "lock" | "unlock"): OnyxCommand {
  const lock = name === "lock";
  return {
    data: new SlashCommandBuilder()
      .setName(name)
      .setDescription(lock ? "Pause member messages in this channel." : "Restore member messages in this channel.")
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
      .addStringOption((option) => option.setName("reason").setDescription(lock ? "Why the channel is being locked" : "Why the channel is reopening").setMaxLength(1_000)),
    category: "Moderation",
    module: "moderation",
    userPermissions: [PermissionFlagsBits.ManageChannels],
    botPermissions: [PermissionFlagsBits.ManageChannels],
    async execute({ interaction, api }) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const channel = interaction.channel;
      if (!channel || !("permissionOverwrites" in channel)) throw new PublicError("This channel does not support permission overrides.");
      await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: lock ? false : null }, { reason: `${reason(interaction)} — ${interaction.user.username}` });
      const record = await api.createCase({
        guildId: interaction.guildId,
        targetUserId: interaction.guildId,
        moderatorUserId: interaction.user.id,
        action: name,
        reason: reason(interaction),
        relatedChannelId: interaction.channelId,
      });
      await interaction.editReply(`This channel is now ${lock ? "locked" : "open again"}. Case #${record.case.caseNumber}.`);
    },
  };
}

const slowmode: OnyxCommand = {
  data: new SlashCommandBuilder()
    .setName("slowmode")
    .setDescription("Set how often members can send messages in this channel.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addIntegerOption((option) => option.setName("seconds").setDescription("Delay in seconds; use 0 to turn it off").setRequired(true).setMinValue(0).setMaxValue(21_600)),
  category: "Moderation",
  module: "moderation",
  userPermissions: [PermissionFlagsBits.ManageChannels],
  botPermissions: [PermissionFlagsBits.ManageChannels],
  async execute({ interaction, api }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const channel = interaction.channel;
    if (!channel || !("setRateLimitPerUser" in channel)) throw new PublicError("Slowmode is not available in this channel.");
    const seconds = interaction.options.getInteger("seconds", true);
    await channel.setRateLimitPerUser(seconds, `Changed by ${interaction.user.username}`);
    const record = await api.createCase({ guildId: interaction.guildId, targetUserId: interaction.guildId, moderatorUserId: interaction.user.id, action: "slowmode", reason: seconds ? `Set to ${seconds} seconds.` : "Disabled.", relatedChannelId: interaction.channelId });
    await interaction.editReply(`${seconds ? `Slowmode is now ${seconds} second${seconds === 1 ? "" : "s"}.` : "Slowmode is now off."} Case #${record.case.caseNumber}.`);
  },
};

export const moderationCommands: OnyxCommand[] = [ban, unban, kick, timeout, untimeout, warn, warningsCommand, purge, channelControl("lock"), channelControl("unlock"), slowmode];
