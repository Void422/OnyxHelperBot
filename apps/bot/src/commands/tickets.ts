import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ButtonInteraction,
  type GuildMember,
} from "discord.js";
import type { GuildSettingsData } from "@/packages/core/src/domain";
import type { OnyxApiClient, TicketRecord } from "../api-client";
import { PublicError } from "../errors";
import { sendGuildLog } from "../events/logging";
import { configuredMessage } from "../messages";
import type { OnyxCommand } from "./types";

function ticketButtons(disabled = false) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("ticket:claim").setLabel("Claim").setStyle(ButtonStyle.Secondary).setDisabled(disabled),
    new ButtonBuilder().setCustomId("ticket:close").setLabel("Close ticket").setStyle(ButtonStyle.Danger).setDisabled(disabled),
  );
}

function cleanName(value: string) {
  return value.toLocaleLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90) || "member";
}

function isTicketStaff(member: GuildMember, settings: GuildSettingsData) {
  return member.permissions.has(PermissionFlagsBits.ManageChannels) || (settings.tickets?.staffRoleIds ?? settings.ticketStaffRoleIds ?? []).some((roleId) => member.roles.cache.has(roleId));
}

async function logTicket(interaction: ButtonInteraction<"cached"> | Parameters<OnyxCommand["execute"]>[0]["interaction"], api: OnyxApiClient, title: string, description: string) {
  await sendGuildLog(interaction.guild, api, "tickets", { embeds: [new EmbedBuilder().setColor(0xe0aa4f).setTitle(title).setDescription(description).addFields({ name: "Actor", value: `${interaction.user} · ${interaction.user.id}` }).setTimestamp()], allowedMentions: { parse: [] } });
}

async function openTicket(interaction: ButtonInteraction<"cached">, api: OnyxApiClient) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const config = await api.getGuildConfig(interaction.guildId, true);
  if (!config.settings?.enabledModules.includes("tickets")) throw new PublicError("The ticket module is disabled for this server.");
  const settings = config.settings.settings;
  const categoryId = settings.tickets?.categoryId ?? settings.ticketCategoryId;
  if (!categoryId) throw new PublicError("Ticket setup is incomplete. An administrator needs to choose a ticket category in the dashboard.");
  const existing = await api.getOpenTickets(interaction.guildId, interaction.user.id);
  const maximum = settings.tickets?.maxOpenPerUser ?? 1;
  if (existing.tickets.length >= maximum) throw new PublicError(`You already have ${existing.tickets.length} open ticket${existing.tickets.length === 1 ? "" : "s"}. Close one before opening another.`);
  const category = await interaction.guild.channels.fetch(categoryId).catch(() => null);
  if (!category || category.type !== ChannelType.GuildCategory) throw new PublicError("The configured ticket category no longer exists.");
  const staffRoleIds = settings.tickets?.staffRoleIds ?? settings.ticketStaffRoleIds ?? [];
  const channel = await interaction.guild.channels.create({
    name: `ticket-${cleanName(interaction.user.username)}`,
    type: ChannelType.GuildText,
    parent: category,
    topic: `Onyx support ticket for ${interaction.user.username} (${interaction.user.id})`,
    permissionOverwrites: [
      { id: interaction.guildId, deny: [PermissionFlagsBits.ViewChannel] },
      { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] },
      { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ReadMessageHistory] },
      ...staffRoleIds.map((roleId) => ({ id: roleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] })),
    ],
    reason: `Ticket opened by ${interaction.user.username}`,
  });
  let ticket: TicketRecord;
  try {
    ticket = (await api.createTicket({ guildId: interaction.guildId, channelId: channel.id, ownerUserId: interaction.user.id })).ticket;
  } catch (error) {
    await channel.delete("Ticket record could not be created").catch(() => undefined);
    throw error;
  }
  const pattern = settings.tickets?.channelNamePattern ?? "ticket-{number}-{username}";
  await channel.setName(cleanName(pattern.replaceAll("{number}", String(ticket.ticketNumber)).replaceAll("{ticket}", String(ticket.ticketNumber)).replaceAll("{username}", interaction.user.username))).catch(() => undefined);
  const template = settings.messages?.ticketOpen ?? {
    title: `Ticket #{ticket}`,
    description: "Hi {mention} — describe what you need help with and a staff member will respond here.",
    footer: "Use the close button when your question is resolved.",
    color: "#D7D2C7",
  };
  await channel.send({ ...configuredMessage(template, { user: interaction.user.id, mention: `<@${interaction.user.id}>`, username: interaction.user.username, server: interaction.guild.name, memberCount: interaction.guild.memberCount, ticket: ticket.ticketNumber }), components: [ticketButtons()] });
  await logTicket(interaction, api, `Ticket #${ticket.ticketNumber} opened`, `${interaction.user} opened ${channel}.`);
  await interaction.editReply(`Your ticket is ready: ${channel}`);
}

async function channelTicket(interaction: Parameters<OnyxCommand["execute"]>[0]["interaction"], api: OnyxApiClient) {
  return api.getTicket(interaction.guildId, interaction.channelId);
}

async function closeTicket(interaction: ButtonInteraction<"cached">, api: OnyxApiClient) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const [current, config] = await Promise.all([api.getTicket(interaction.guildId, interaction.channelId), api.getGuildConfig(interaction.guildId, true)]);
  const settings = config.settings?.settings ?? {};
  if (interaction.user.id !== current.ticket.ownerUserId && !isTicketStaff(interaction.member, settings)) throw new PublicError("Only the ticket owner or support staff can close this ticket.");
  if (interaction.user.id === current.ticket.ownerUserId && settings.tickets?.allowUserClose === false) throw new PublicError("This server asks support staff to close tickets.");
  const channel = interaction.channel;
  if (!channel || channel.type !== ChannelType.GuildText) throw new PublicError("This ticket channel can no longer be managed.");
  await api.updateTicket({ guildId: interaction.guildId, channelId: channel.id, actorUserId: interaction.user.id, action: "close", reason: "Closed from the ticket controls." });
  await channel.permissionOverwrites.edit(current.ticket.ownerUserId, { SendMessages: false }, { reason: `Ticket closed by ${interaction.user.username}` });
  await channel.setName(`closed-${current.ticket.ticketNumber}`).catch(() => undefined);
  await channel.send({ embeds: [new EmbedBuilder().setColor(0x7e5652).setTitle(`Ticket #${current.ticket.ticketNumber} closed`).setDescription(`Closed by ${interaction.user}. Staff can reopen it with \`/ticket reopen\`.`).setTimestamp()], components: [] });
  await logTicket(interaction, api, `Ticket #${current.ticket.ticketNumber} closed`, `${interaction.user} closed <#${channel.id}> from the ticket controls.`);
  await interaction.editReply("Ticket closed.");
}

export async function handleTicketButton(interaction: ButtonInteraction, api: OnyxApiClient) {
  if (!interaction.inCachedGuild()) throw new PublicError("Tickets can only be used inside a server.");
  if (interaction.customId === "ticket:open") return openTicket(interaction, api);
  if (interaction.customId === "ticket:close") return closeTicket(interaction, api);
  if (interaction.customId === "ticket:claim") {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const config = await api.getGuildConfig(interaction.guildId, true);
    if (!isTicketStaff(interaction.member, config.settings?.settings ?? {})) throw new PublicError("Only configured support staff can claim tickets.");
    const updated = await api.updateTicket({ guildId: interaction.guildId, channelId: interaction.channelId, actorUserId: interaction.user.id, action: "claim" });
    await interaction.channel?.send({ content: `${interaction.user} claimed ticket #${updated.ticket.ticketNumber}.`, allowedMentions: { users: [interaction.user.id] } });
    await logTicket(interaction, api, `Ticket #${updated.ticket.ticketNumber} claimed`, `${interaction.user} claimed <#${interaction.channelId}>.`);
    await interaction.editReply("Ticket claimed.");
  }
}

const ticket: OnyxCommand = {
  data: new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("Create a support panel and manage ticket channels.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addSubcommand((subcommand) => subcommand.setName("panel").setDescription("Post the configured ticket-opening panel.").addChannelOption((option) => option.setName("channel").setDescription("Where to post the panel").setRequired(true).addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)))
    .addSubcommand((subcommand) => subcommand.setName("info").setDescription("Review the current ticket record."))
    .addSubcommand((subcommand) => subcommand.setName("claim").setDescription("Claim the current ticket."))
    .addSubcommand((subcommand) => subcommand.setName("close").setDescription("Close the current ticket.").addStringOption((option) => option.setName("reason").setDescription("Why the ticket is closing").setMaxLength(1_000)))
    .addSubcommand((subcommand) => subcommand.setName("reopen").setDescription("Reopen the current ticket."))
    .addSubcommand((subcommand) => subcommand.setName("add").setDescription("Give another member access to this ticket.").addUserOption((option) => option.setName("member").setDescription("The member to add").setRequired(true)))
    .addSubcommand((subcommand) => subcommand.setName("remove").setDescription("Remove another participant from this ticket.").addUserOption((option) => option.setName("member").setDescription("The participant to remove").setRequired(true)))
    .addSubcommand((subcommand) => subcommand.setName("rename").setDescription("Rename the current ticket channel.").addStringOption((option) => option.setName("name").setDescription("The new channel name").setRequired(true).setMinLength(1).setMaxLength(90)))
    .addSubcommand((subcommand) => subcommand.setName("transcript").setDescription("Export the latest 100 messages as a text file.")),
  category: "Tickets",
  module: "tickets",
  userPermissions: [PermissionFlagsBits.ManageChannels],
  botPermissions: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.SendMessages],
  cooldownSeconds: 2,
  async execute({ interaction, api }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === "panel") {
      const config = await api.getGuildConfig(interaction.guildId, true);
      const settings = config.settings?.settings.tickets;
      if (!(settings?.categoryId ?? config.settings?.settings.ticketCategoryId)) throw new PublicError("Choose a ticket category in the dashboard before posting a panel.");
      const channel = interaction.options.getChannel("channel", true);
      if (!channel.isTextBased() || channel.isDMBased() || !("send" in channel)) throw new PublicError("Choose a server text or announcement channel.");
      await channel.send({ embeds: [new EmbedBuilder().setColor(0x292a30).setTitle(settings?.panelTitle ?? "Need a hand?").setDescription(settings?.panelDescription ?? "Open a private ticket and the support team will meet you there.")], components: [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId("ticket:open").setLabel(settings?.buttonLabel ?? "Open a ticket").setStyle(ButtonStyle.Secondary))] });
      await interaction.editReply(`Ticket panel posted in <#${channel.id}>.`);
      return;
    }
    const current = await channelTicket(interaction, api);
    const channel = interaction.channel;
    if (!channel || channel.type !== ChannelType.GuildText) throw new PublicError("Run this inside an Onyx ticket channel.");
    if (subcommand === "info") {
      await interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x292a30).setTitle(`Ticket #${current.ticket.ticketNumber}`).addFields(
        { name: "Owner", value: `<@${current.ticket.ownerUserId}>`, inline: true },
        { name: "Status", value: current.ticket.status, inline: true },
        { name: "Claimed by", value: current.ticket.claimedBy ? `<@${current.ticket.claimedBy}>` : "Unclaimed", inline: true },
        { name: "Participants", value: current.participants.length ? current.participants.map((item) => `<@${item.userId}>`).join(", ") : "None added", inline: false },
      )], allowedMentions: { parse: [] } });
      return;
    }
    if (subcommand === "claim") {
      const result = await api.updateTicket({ guildId: interaction.guildId, channelId: channel.id, actorUserId: interaction.user.id, action: "claim" });
      await channel.send({ content: `${interaction.user} claimed ticket #${result.ticket.ticketNumber}.`, allowedMentions: { users: [interaction.user.id] } });
      await logTicket(interaction, api, `Ticket #${result.ticket.ticketNumber} claimed`, `${interaction.user} claimed ${channel}.`);
      await interaction.editReply("Ticket claimed.");
      return;
    }
    if (subcommand === "close") {
      const reason = interaction.options.getString("reason")?.trim() || "Closed by support staff.";
      await api.updateTicket({ guildId: interaction.guildId, channelId: channel.id, actorUserId: interaction.user.id, action: "close", reason });
      await channel.permissionOverwrites.edit(current.ticket.ownerUserId, { SendMessages: false }, { reason });
      await channel.setName(`closed-${current.ticket.ticketNumber}`).catch(() => undefined);
      await channel.send({ embeds: [new EmbedBuilder().setColor(0x7e5652).setTitle(`Ticket #${current.ticket.ticketNumber} closed`).setDescription(reason).setTimestamp()] });
      await logTicket(interaction, api, `Ticket #${current.ticket.ticketNumber} closed`, `${interaction.user} closed ${channel}.\n\n${reason}`);
      await interaction.editReply("Ticket closed.");
      return;
    }
    if (subcommand === "reopen") {
      await api.updateTicket({ guildId: interaction.guildId, channelId: channel.id, actorUserId: interaction.user.id, action: "reopen" });
      await channel.permissionOverwrites.edit(current.ticket.ownerUserId, { SendMessages: true }, { reason: `Ticket reopened by ${interaction.user.username}` });
      await channel.setName(`ticket-${current.ticket.ticketNumber}`).catch(() => undefined);
      await channel.send(`Ticket #${current.ticket.ticketNumber} was reopened by ${interaction.user}.`);
      await logTicket(interaction, api, `Ticket #${current.ticket.ticketNumber} reopened`, `${interaction.user} reopened ${channel}.`);
      await interaction.editReply("Ticket reopened.");
      return;
    }
    if (subcommand === "add" || subcommand === "remove") {
      const user = interaction.options.getUser("member", true);
      if (user.id === current.ticket.ownerUserId) throw new PublicError("The ticket owner already has permanent access to this channel.");
      const adding = subcommand === "add";
      await channel.permissionOverwrites.edit(user.id, { ViewChannel: adding ? true : null, SendMessages: adding ? true : null, ReadMessageHistory: adding ? true : null }, { reason: `${adding ? "Added" : "Removed"} by ${interaction.user.username}` });
      await api.updateTicket({ guildId: interaction.guildId, channelId: channel.id, actorUserId: interaction.user.id, action: adding ? "participant_add" : "participant_remove", userId: user.id });
      await logTicket(interaction, api, `Ticket participant ${adding ? "added" : "removed"}`, `${interaction.user} ${adding ? "added" : "removed"} ${user} ${adding ? "to" : "from"} ticket #${current.ticket.ticketNumber}.`);
      await interaction.editReply(`${adding ? "Added" : "Removed"} ${user.username} ${adding ? "to" : "from"} this ticket.`);
      return;
    }
    if (subcommand === "rename") {
      const name = cleanName(interaction.options.getString("name", true));
      await channel.setName(name, `Renamed by ${interaction.user.username}`);
      await logTicket(interaction, api, `Ticket #${current.ticket.ticketNumber} renamed`, `${interaction.user} renamed the channel to **${name}**.`);
      await interaction.editReply(`Ticket channel renamed to **${name}**.`);
      return;
    }
    if (subcommand === "transcript") {
      const messages = await channel.messages.fetch({ limit: 100 });
      const body = [...messages.values()].sort((left, right) => left.createdTimestamp - right.createdTimestamp).map((message) => `[${message.createdAt.toISOString()}] ${message.author.username} (${message.author.id}): ${message.cleanContent}${message.attachments.size ? ` [attachments: ${message.attachments.map((attachment) => attachment.url).join(", ")}]` : ""}`).join("\n");
      const attachment = new AttachmentBuilder(Buffer.from(body || "No messages were available."), { name: `ticket-${current.ticket.ticketNumber}.txt`, description: `Transcript for ticket #${current.ticket.ticketNumber}` });
      await interaction.editReply({ content: `Transcript for ticket #${current.ticket.ticketNumber}.`, files: [attachment] });
    }
  },
};

export const ticketCommands: OnyxCommand[] = [ticket];
