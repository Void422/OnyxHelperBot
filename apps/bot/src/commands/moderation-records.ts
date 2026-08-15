import { EmbedBuilder, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { formatDuration, parseDuration } from "@/packages/core/src/duration";
import { PublicError } from "../errors";
import { assertHierarchy, reason, replyCase, targetMember } from "./moderation";
import type { OnyxCommand } from "./types";

const softban: OnyxCommand = {
  data: new SlashCommandBuilder()
    .setName("softban")
    .setDescription("Remove a member and clear recent messages, then immediately lift the ban.")
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption((option) => option.setName("member").setDescription("The member to softban").setRequired(true))
    .addIntegerOption((option) => option.setName("delete_days").setDescription("Days of recent messages to delete").setMinValue(0).setMaxValue(7))
    .addStringOption((option) => option.setName("reason").setDescription("Why this member is being softbanned").setMaxLength(1_000)),
  category: "Moderation",
  module: "moderation",
  userPermissions: [PermissionFlagsBits.BanMembers],
  botPermissions: [PermissionFlagsBits.BanMembers],
  cooldownSeconds: 5,
  async execute({ interaction, api }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const user = interaction.options.getUser("member", true);
    const member = await targetMember(interaction, user);
    if (!member) throw new PublicError("That member is no longer in the server.");
    assertHierarchy(interaction, member);
    const moderationReason = reason(interaction);
    await interaction.guild.members.ban(user.id, { reason: `${moderationReason} — ${interaction.user.username}`.slice(0, 512), deleteMessageSeconds: (interaction.options.getInteger("delete_days") ?? 1) * 86_400 });
    await interaction.guild.bans.remove(user.id, "Onyx softban completed");
    const record = await api.createCase({ guildId: interaction.guildId, targetUserId: user.id, moderatorUserId: interaction.user.id, action: "softban", reason: moderationReason });
    await replyCase(interaction, `${user.username} was softbanned and can rejoin with a new invite.`, record.case.caseNumber, api);
  },
};

function timeoutAlias(commandName: "mute" | "unmute"): OnyxCommand {
  const apply = commandName === "mute";
  return {
    data: new SlashCommandBuilder()
      .setName(commandName)
      .setDescription(apply ? "Temporarily stop a member from participating anywhere in the server." : "Remove a member's active communication timeout.")
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
      .addUserOption((option) => option.setName("member").setDescription(apply ? "The member to mute" : "The member to unmute").setRequired(true))
      .addStringOption((option) => option.setName("duration").setDescription("How long, such as 30m, 12h, or 7d").setRequired(apply))
      .addStringOption((option) => option.setName("reason").setDescription(apply ? "Why this member is being muted" : "Why the mute is ending").setMaxLength(1_000)),
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
      const durationText = interaction.options.getString("duration");
      const durationMs = apply && durationText ? parseDuration(durationText) : null;
      if (apply && !durationMs) throw new PublicError("Use a duration like `30m`, `12h`, or `7d` (up to 28 days).");
      const moderationReason = reason(interaction);
      await member.timeout(durationMs, `${moderationReason} — ${interaction.user.username}`);
      const record = await api.createCase({
        guildId: interaction.guildId,
        targetUserId: user.id,
        moderatorUserId: interaction.user.id,
        action: apply ? "mute" : "unmute",
        reason: moderationReason,
        durationMs: durationMs ?? undefined,
        expiresAt: durationMs ? new Date(Date.now() + durationMs) : undefined,
      });
      await replyCase(interaction, apply ? `${user.username} was muted for ${formatDuration(durationMs!)}.` : `${user.username}'s mute was removed.`, record.case.caseNumber, api);
    },
  };
}

function nicknameCommand(commandName: "nick" | "resetnick"): OnyxCommand {
  const reset = commandName === "resetnick";
  return {
    data: new SlashCommandBuilder()
      .setName(commandName)
      .setDescription(reset ? "Restore a member's Discord username in the member list." : "Change a member's server nickname.")
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames)
      .addUserOption((option) => option.setName("member").setDescription("The member to update").setRequired(true))
      .addStringOption((option) => option.setName("nickname").setDescription("The new server nickname").setRequired(!reset).setMaxLength(32))
      .addStringOption((option) => option.setName("reason").setDescription("Why the nickname is being changed").setMaxLength(1_000)),
    category: "Moderation",
    module: "moderation",
    userPermissions: [PermissionFlagsBits.ManageNicknames],
    botPermissions: [PermissionFlagsBits.ManageNicknames],
    async execute({ interaction, api }) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const user = interaction.options.getUser("member", true);
      const member = await targetMember(interaction, user);
      if (!member) throw new PublicError("That member is no longer in the server.");
      assertHierarchy(interaction, member);
      const nickname = reset ? null : interaction.options.getString("nickname", true).trim();
      await member.setNickname(nickname, `${reason(interaction)} — ${interaction.user.username}`);
      const record = await api.createCase({ guildId: interaction.guildId, targetUserId: user.id, moderatorUserId: interaction.user.id, action: commandName, reason: reason(interaction) });
      await replyCase(interaction, reset ? `${user.username}'s nickname was reset.` : `${user.username}'s nickname is now ${nickname}.`, record.case.caseNumber, api);
    },
  };
}

const history: OnyxCommand = {
  data: new SlashCommandBuilder()
    .setName("history")
    .setDescription("Review a member's recent moderation history.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) => option.setName("member").setDescription("The member whose history you want to review").setRequired(true)),
  category: "Moderation",
  module: "moderation",
  userPermissions: [PermissionFlagsBits.ModerateMembers],
  async execute({ interaction, api }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const user = interaction.options.getUser("member", true);
    const result = await api.getCases(interaction.guildId, user.id);
    if (!result.cases.length) return void await interaction.editReply(`No moderation history was found for ${user.username}.`);
    const lines = result.cases.slice(0, 10).map((record) => `**#${record.caseNumber} · ${record.action.replace(/_/g, " ")}**${record.active ? "" : " · inactive"}\n${record.reason}\n<t:${Math.floor(new Date(record.createdAt).getTime() / 1_000)}:R> · by <@${record.moderatorUserId}>`);
    await interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x292a30).setTitle(`History for ${user.username}`).setDescription(lines.join("\n\n")).setFooter({ text: `Showing ${Math.min(result.cases.length, 10)} recent cases` })] });
  },
};

const caseCommand: OnyxCommand = {
  data: new SlashCommandBuilder()
    .setName("case")
    .setDescription("Open one moderation case by its server case number.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addIntegerOption((option) => option.setName("number").setDescription("The case number").setRequired(true).setMinValue(1)),
  category: "Moderation",
  module: "moderation",
  userPermissions: [PermissionFlagsBits.ModerateMembers],
  async execute({ interaction, api }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const result = await api.getCase(interaction.guildId, interaction.options.getInteger("number", true));
    const record = result.case;
    await interaction.editReply({ embeds: [new EmbedBuilder().setColor(record.active ? 0x32343a : 0x202126).setTitle(`Case #${record.caseNumber} · ${record.action.replace(/_/g, " ")}`).setDescription(record.reason).addFields(
      { name: "Member", value: `<@${record.targetUserId}> · ${record.targetUserId}`, inline: true },
      { name: "Moderator", value: `<@${record.moderatorUserId}>`, inline: true },
      { name: "Status", value: record.active ? "Active" : "Inactive", inline: true },
      ...(record.expiresAt ? [{ name: "Expires", value: `<t:${Math.floor(new Date(record.expiresAt).getTime() / 1_000)}:F>`, inline: true }] : []),
    ).setTimestamp(new Date(record.createdAt))], allowedMentions: { parse: [] } });
  },
};

const updateReason: OnyxCommand = {
  data: new SlashCommandBuilder()
    .setName("reason")
    .setDescription("Correct or expand the reason attached to a moderation case.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addIntegerOption((option) => option.setName("case").setDescription("The case number").setRequired(true).setMinValue(1))
    .addStringOption((option) => option.setName("reason").setDescription("The corrected reason").setRequired(true).setMaxLength(1_000)),
  category: "Moderation",
  module: "moderation",
  userPermissions: [PermissionFlagsBits.ModerateMembers],
  async execute({ interaction, api }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const caseNumber = interaction.options.getInteger("case", true);
    await api.updateCaseReason({ guildId: interaction.guildId, caseNumber, moderatorUserId: interaction.user.id, reason: interaction.options.getString("reason", true).trim() });
    await interaction.editReply(`Case #${caseNumber} now has the updated reason.`);
  },
};

const delwarn: OnyxCommand = {
  data: new SlashCommandBuilder()
    .setName("delwarn")
    .setDescription("Remove one active warning using its moderation case number.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) => option.setName("member").setDescription("The warned member").setRequired(true))
    .addIntegerOption((option) => option.setName("case").setDescription("The warning's case number").setRequired(true).setMinValue(1)),
  category: "Moderation",
  module: "moderation",
  userPermissions: [PermissionFlagsBits.ModerateMembers],
  async execute({ interaction, api }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const user = interaction.options.getUser("member", true);
    const caseNumber = interaction.options.getInteger("case", true);
    const current = await api.getWarnings(interaction.guildId, user.id);
    const warning = current.warnings.find((item) => item.caseNumber === caseNumber);
    if (!warning) throw new PublicError(`Active warning case #${caseNumber} was not found for ${user.username}.`);
    await api.removeWarning({ guildId: interaction.guildId, userId: user.id, moderatorUserId: interaction.user.id, warningId: warning.id });
    await interaction.editReply(`Warning case #${caseNumber} was removed from ${user.username}.`);
  },
};

const clearwarns: OnyxCommand = {
  data: new SlashCommandBuilder()
    .setName("clearwarns")
    .setDescription("Clear every active warning for one member.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) => option.setName("member").setDescription("The member whose warnings should be cleared").setRequired(true)),
  category: "Moderation",
  module: "moderation",
  userPermissions: [PermissionFlagsBits.ModerateMembers],
  async execute({ interaction, api }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const user = interaction.options.getUser("member", true);
    const result = await api.removeWarning({ guildId: interaction.guildId, userId: user.id, moderatorUserId: interaction.user.id, clearAll: true });
    await interaction.editReply(`Cleared ${result.removedCount} active warning${result.removedCount === 1 ? "" : "s"} for ${user.username}.`);
  },
};

const modnote: OnyxCommand = {
  data: new SlashCommandBuilder()
    .setName("modnote")
    .setDescription("Add a private staff note to a member's record.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) => option.setName("member").setDescription("The member this note is about").setRequired(true))
    .addStringOption((option) => option.setName("note").setDescription("The staff-only note").setRequired(true).setMaxLength(1_000)),
  category: "Moderation",
  module: "moderation",
  userPermissions: [PermissionFlagsBits.ModerateMembers],
  async execute({ interaction, api }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const user = interaction.options.getUser("member", true);
    const result = await api.addModeratorNote({ guildId: interaction.guildId, userId: user.id, moderatorUserId: interaction.user.id, note: interaction.options.getString("note", true).trim() });
    await interaction.editReply(`Private note \`${result.note.id.slice(0, 8)}\` was added for ${user.username}.`);
  },
};

const notes: OnyxCommand = {
  data: new SlashCommandBuilder()
    .setName("notes")
    .setDescription("Review private staff notes for a member.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) => option.setName("member").setDescription("The member whose notes you want to review").setRequired(true)),
  category: "Moderation",
  module: "moderation",
  userPermissions: [PermissionFlagsBits.ModerateMembers],
  async execute({ interaction, api }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const user = interaction.options.getUser("member", true);
    const result = await api.getModeratorNotes(interaction.guildId, user.id);
    if (!result.notes.length) return void await interaction.editReply(`No private staff notes were found for ${user.username}.`);
    const lines = result.notes.slice(0, 10).map((note) => `**\`${note.id.slice(0, 8)}\`** · <@${note.moderatorUserId}> · <t:${Math.floor(new Date(note.createdAt).getTime() / 1_000)}:R>\n${note.note}`);
    await interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x292a30).setTitle(`Staff notes for ${user.username}`).setDescription(lines.join("\n\n"))], allowedMentions: { parse: [] } });
  },
};

const removenote: OnyxCommand = {
  data: new SlashCommandBuilder()
    .setName("removenote")
    .setDescription("Remove a private staff note using its short ID.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) => option.setName("member").setDescription("The member the note belongs to").setRequired(true))
    .addStringOption((option) => option.setName("note_id").setDescription("The note ID shown by /notes").setRequired(true).setMinLength(8).setMaxLength(36)),
  category: "Moderation",
  module: "moderation",
  userPermissions: [PermissionFlagsBits.ModerateMembers],
  async execute({ interaction, api }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const user = interaction.options.getUser("member", true);
    const candidate = interaction.options.getString("note_id", true).toLowerCase();
    const current = await api.getModeratorNotes(interaction.guildId, user.id);
    const matches = current.notes.filter((note) => note.id.toLowerCase().startsWith(candidate));
    if (matches.length !== 1) throw new PublicError(matches.length ? "That short ID matches more than one note; paste the full ID." : "That note was not found for this member.");
    await api.removeModeratorNote({ guildId: interaction.guildId, noteId: matches[0].id, moderatorUserId: interaction.user.id });
    await interaction.editReply(`Private note \`${matches[0].id.slice(0, 8)}\` was removed.`);
  },
};

export const moderationRecordCommands: OnyxCommand[] = [
  softban,
  timeoutAlias("mute"),
  timeoutAlias("unmute"),
  nicknameCommand("nick"),
  nicknameCommand("resetnick"),
  history,
  caseCommand,
  updateReason,
  delwarn,
  clearwarns,
  modnote,
  notes,
  removenote,
];
