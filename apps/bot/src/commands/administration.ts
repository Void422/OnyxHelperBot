import { ChannelType, EmbedBuilder, MessageFlags, PermissionFlagsBits, SlashCommandBuilder, type Role } from "discord.js";
import { PublicError } from "../errors";
import type { OnyxCommand } from "./types";

function assertRoleManageable(interaction: Parameters<OnyxCommand["execute"]>[0]["interaction"], role: Role) {
  const bot = interaction.guild.members.me;
  if (!bot || role.id === interaction.guildId || role.managed || role.position >= bot.roles.highest.position) {
    throw new PublicError(`Move the Onyx bot role above **${role.name}** before Onyx can manage it.`);
  }
  if (interaction.user.id !== interaction.guild.ownerId && role.position >= interaction.member.roles.highest.position) {
    throw new PublicError("You can only manage roles below your highest role.");
  }
}

const roleCommand: OnyxCommand = {
  data: new SlashCommandBuilder()
    .setName("role")
    .setDescription("Add, remove, or inspect server roles safely.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand((subcommand) => subcommand.setName("add").setDescription("Give a role to a member.")
      .addUserOption((option) => option.setName("member").setDescription("The member receiving the role").setRequired(true))
      .addRoleOption((option) => option.setName("role").setDescription("The role to add").setRequired(true))
      .addStringOption((option) => option.setName("reason").setDescription("Why the role is being added").setMaxLength(512)))
    .addSubcommand((subcommand) => subcommand.setName("remove").setDescription("Remove a role from a member.")
      .addUserOption((option) => option.setName("member").setDescription("The member losing the role").setRequired(true))
      .addRoleOption((option) => option.setName("role").setDescription("The role to remove").setRequired(true))
      .addStringOption((option) => option.setName("reason").setDescription("Why the role is being removed").setMaxLength(512)))
    .addSubcommand((subcommand) => subcommand.setName("members").setDescription("List members who currently have a role.")
      .addRoleOption((option) => option.setName("role").setDescription("The role to inspect").setRequired(true))),
  category: "Administration",
  module: "moderation",
  userPermissions: [PermissionFlagsBits.ManageRoles],
  botPermissions: [PermissionFlagsBits.ManageRoles],
  cooldownSeconds: 2,
  async execute({ interaction, api }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const subcommand = interaction.options.getSubcommand();
    const role = interaction.options.getRole("role", true);
    if (subcommand === "members") {
      const members = role.members.map((member) => `${member} · ${member.user.username}`);
      await interaction.editReply({ embeds: [new EmbedBuilder().setColor(role.color || 0x292a30).setTitle(`${role.name} · ${members.length} members`).setDescription(members.length ? members.slice(0, 50).join("\n") : "Nobody currently has this role.").setFooter(members.length > 50 ? { text: `Showing 50 of ${members.length}` } : null)], allowedMentions: { parse: [] } });
      return;
    }
    assertRoleManageable(interaction, role);
    const user = interaction.options.getUser("member", true);
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) throw new PublicError("That member is no longer in the server.");
    const adding = subcommand === "add";
    if (adding && member.roles.cache.has(role.id)) throw new PublicError(`${user.username} already has **${role.name}**.`);
    if (!adding && !member.roles.cache.has(role.id)) throw new PublicError(`${user.username} does not have **${role.name}**.`);
    const reason = interaction.options.getString("reason")?.trim() || `${adding ? "Added" : "Removed"} by ${interaction.user.username}`;
    if (adding) await member.roles.add(role, reason);
    else await member.roles.remove(role, reason);
    const record = await api.createCase({ guildId: interaction.guildId, targetUserId: user.id, moderatorUserId: interaction.user.id, action: adding ? "role_add" : "role_remove", reason: `${adding ? "Added" : "Removed"} ${role.name}: ${reason}` });
    await interaction.editReply(`${adding ? "Added" : "Removed"} **${role.name}** ${adding ? "to" : "from"} ${user.username}. Case #${record.case.caseNumber}.`);
  },
};

const announce: OnyxCommand = {
  data: new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Post a polished announcement in a chosen channel.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption((option) => option.setName("channel").setDescription("Where to post the announcement").setRequired(true).addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
    .addStringOption((option) => option.setName("title").setDescription("Announcement title").setRequired(true).setMaxLength(256))
    .addStringOption((option) => option.setName("message").setDescription("Announcement body").setRequired(true).setMaxLength(4_096))
    .addStringOption((option) => option.setName("color").setDescription("Optional hex color, such as #D7D2C7").setMinLength(7).setMaxLength(7))
    .addStringOption((option) => option.setName("image").setDescription("Optional HTTPS image URL").setMaxLength(1_000)),
  category: "Administration",
  userPermissions: [PermissionFlagsBits.ManageGuild],
  botPermissions: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks],
  cooldownSeconds: 5,
  async execute({ interaction }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const channel = interaction.options.getChannel("channel", true);
    if (!channel.isTextBased() || channel.isDMBased() || !("send" in channel)) throw new PublicError("Choose a server text or announcement channel.");
    const color = interaction.options.getString("color") ?? "#D7D2C7";
    if (!/^#[0-9a-f]{6}$/i.test(color)) throw new PublicError("Use a six-digit hex color such as `#D7D2C7`.");
    const image = interaction.options.getString("image");
    if (image && (!URL.canParse(image) || new URL(image).protocol !== "https:")) throw new PublicError("Announcement images need a valid HTTPS URL.");
    const embed = new EmbedBuilder().setColor(color as `#${string}`).setTitle(interaction.options.getString("title", true)).setDescription(interaction.options.getString("message", true)).setFooter({ text: `Posted by ${interaction.user.username}` }).setTimestamp();
    if (image) embed.setImage(image);
    const posted = await channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
    await interaction.editReply(`Announcement posted in <#${channel.id}> · [open message](${posted.url}).`);
  },
};

const say: OnyxCommand = {
  data: new SlashCommandBuilder()
    .setName("say")
    .setDescription("Post a plain message through Onyx without mentions.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption((option) => option.setName("message").setDescription("The message to post").setRequired(true).setMaxLength(2_000))
    .addChannelOption((option) => option.setName("channel").setDescription("Where to post; defaults to this channel").addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)),
  category: "Administration",
  userPermissions: [PermissionFlagsBits.ManageMessages],
  botPermissions: [PermissionFlagsBits.SendMessages],
  cooldownSeconds: 3,
  async execute({ interaction }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const channel = interaction.options.getChannel("channel") ?? interaction.channel;
    if (!channel?.isTextBased() || channel.isDMBased() || !("send" in channel)) throw new PublicError("Choose a server text or announcement channel.");
    const posted = await channel.send({ content: interaction.options.getString("message", true), allowedMentions: { parse: [] } });
    await interaction.editReply(`Message posted in <#${channel.id}> · [open message](${posted.url}).`);
  },
};

const topic: OnyxCommand = {
  data: new SlashCommandBuilder()
    .setName("topic")
    .setDescription("Update a text channel's topic.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addChannelOption((option) => option.setName("channel").setDescription("The text channel to update").addChannelTypes(ChannelType.GuildText))
    .addStringOption((option) => option.setName("topic").setDescription("The new topic; leave empty to clear it").setMaxLength(1_024)),
  category: "Administration",
  userPermissions: [PermissionFlagsBits.ManageChannels],
  botPermissions: [PermissionFlagsBits.ManageChannels],
  async execute({ interaction }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const selected = interaction.options.getChannel("channel") ?? interaction.channel;
    if (!selected || selected.type !== ChannelType.GuildText) throw new PublicError("Choose a standard server text channel.");
    const value = interaction.options.getString("topic")?.trim() || null;
    await selected.setTopic(value, `Changed by ${interaction.user.username}`);
    await interaction.editReply(value ? `Updated the topic for <#${selected.id}>.` : `Cleared the topic for <#${selected.id}>.`);
  },
};

const thread: OnyxCommand = {
  data: new SlashCommandBuilder()
    .setName("thread")
    .setDescription("Start a public thread in the current text channel.")
    .setDefaultMemberPermissions(PermissionFlagsBits.CreatePublicThreads)
    .addStringOption((option) => option.setName("name").setDescription("Thread name").setRequired(true).setMinLength(1).setMaxLength(100))
    .addStringOption((option) => option.setName("message").setDescription("Optional opening message").setMaxLength(2_000)),
  category: "Administration",
  userPermissions: [PermissionFlagsBits.CreatePublicThreads],
  botPermissions: [PermissionFlagsBits.CreatePublicThreads, PermissionFlagsBits.SendMessagesInThreads],
  async execute({ interaction }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const channel = interaction.channel;
    if (!channel || channel.type !== ChannelType.GuildText) throw new PublicError("Start this command in a standard server text channel.");
    const created = await channel.threads.create({ name: interaction.options.getString("name", true), reason: `Created by ${interaction.user.username}` });
    const opening = interaction.options.getString("message");
    if (opening) await created.send({ content: opening, allowedMentions: { parse: [] } });
    await interaction.editReply(`Created ${created}.`);
  },
};

const messageLimit: OnyxCommand = {
  data: new SlashCommandBuilder()
    .setName("message-limit")
    .setDescription("Control how many messages each person can post in a channel.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((subcommand) => subcommand.setName("set").setDescription("Set or change a channel's per-person message limit.")
      .addChannelOption((option) => option.setName("channel").setDescription("The channel to limit").setRequired(true).addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
      .addIntegerOption((option) => option.setName("maximum").setDescription("Messages allowed per person").setRequired(true).setMinValue(1).setMaxValue(100_000)))
    .addSubcommand((subcommand) => subcommand.setName("remove").setDescription("Remove a channel's message limit.")
      .addChannelOption((option) => option.setName("channel").setDescription("The channel to stop limiting").setRequired(true).addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)))
    .addSubcommand((subcommand) => subcommand.setName("list").setDescription("List every active channel message limit.")),
  category: "Administration",
  userPermissions: [PermissionFlagsBits.Administrator],
  cooldownSeconds: 2,
  async execute({ interaction, api }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "list") {
      const config = await api.getGuildConfig(interaction.guildId, true);
      const limits = (config.channelMessageLimits ?? []).filter((limit) => limit.enabled).sort((left, right) => left.channelId.localeCompare(right.channelId));
      if (!limits.length) {
        await interaction.editReply("No channel message limits are active.");
        return;
      }
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(0xd7d2c7)
          .setTitle("Channel message limits")
          .setDescription(limits.map((limit) => `<#${limit.channelId}> — **${limit.maxMessages.toLocaleString()}** per person`).join("\n"))],
        allowedMentions: { parse: [] },
      });
      return;
    }

    const channel = interaction.options.getChannel("channel", true);
    if (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement) throw new PublicError("Choose a server text or announcement channel.");

    if (subcommand === "remove") {
      await api.removeChannelMessageLimit({ guildId: interaction.guildId, channelId: channel.id, actorUserId: interaction.user.id });
      await interaction.editReply(`Removed the message limit from <#${channel.id}>.`);
      return;
    }

    const bot = interaction.guild.members.me;
    const permissions = bot ? channel.permissionsFor(bot) : null;
    const missing = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages]
      .filter((permission) => !permissions?.has(permission));
    if (missing.length) throw new PublicError(`Onyx needs **View Channel**, **Read Message History**, and **Manage Messages** in <#${channel.id}> before this limit can work.`);

    const maximum = interaction.options.getInteger("maximum", true);
    await api.setChannelMessageLimit({ guildId: interaction.guildId, channelId: channel.id, actorUserId: interaction.user.id, maxMessages: maximum });
    await interaction.editReply(`Each person can now post **${maximum.toLocaleString()}** messages in <#${channel.id}>. Later messages will be deleted automatically.`);
  },
};

export const administrationCommands: OnyxCommand[] = [roleCommand, announce, say, topic, thread, messageLimit];
