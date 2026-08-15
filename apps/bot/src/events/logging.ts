import { EmbedBuilder, type Guild, type GuildBasedChannel, type Message, type MessageCreateOptions, type PartialMessage, type Role, type VoiceState } from "discord.js";
import type { OnyxApiClient } from "../api-client";
import { logger } from "../logger";

async function logChannel(guildId: string, api: OnyxApiClient, category: string, guild: Message<true>["guild"] | Role["guild"] | GuildBasedChannel["guild"]) {
  const config = await api.getGuildConfig(guildId);
  if (!config.settings?.enabledModules.includes("logging")) return null;
  const channelId = config.logs?.channels[category]
    ?? (category === "moderation" ? config.settings.settings.moderationLogChannelId : undefined)
    ?? (category === "tickets" ? config.settings.settings.tickets?.logChannelId : undefined);
  if (!channelId) return null;
  const channel = await guild.channels.fetch(channelId).catch(() => null);
  return channel?.isTextBased() && !channel.isDMBased() && "send" in channel ? channel : null;
}

export async function sendGuildLog(guild: Guild, api: OnyxApiClient, category: string, message: MessageCreateOptions) {
  try {
    const channel = await logChannel(guild.id, api, category, guild);
    if (!channel) return;
    const config = await api.getGuildConfig(guild.id);
    const outgoing = config.logs?.includeModerator === false && message.embeds
      ? { ...message, embeds: message.embeds.map((embed) => { const data = "toJSON" in embed ? embed.toJSON() : embed; return EmbedBuilder.from(data).setFields((data.fields ?? []).filter((field) => !["moderator", "actor"].includes(field.name.toLocaleLowerCase()))); }) }
      : message;
    await channel.send(outgoing);
  } catch (error) {
    logger.warn({ event: "log.delivery_failed", guildId: guild.id, category, error });
  }
}

function clipped(value: string | null | undefined, maximum = 1_000) {
  const text = value?.trim() || "No text content";
  return text.length > maximum ? `${text.slice(0, maximum - 1)}…` : text;
}

export async function handleMessageDelete(message: Message | PartialMessage, api: OnyxApiClient) {
  if (!message.inGuild() || message.author?.bot) return;
  try {
    const channel = await logChannel(message.guildId, api, "messages", message.guild);
    if (!channel) return;
    await channel.send({
      embeds: [new EmbedBuilder().setColor(0x8d5d5a).setTitle("Message deleted").setDescription(clipped(message.content)).addFields(
        { name: "Author", value: message.author ? `${message.author} · ${message.author.id}` : "Unknown", inline: true },
        { name: "Channel", value: `<#${message.channelId}>`, inline: true },
      ).setTimestamp()],
      allowedMentions: { parse: [] },
    });
  } catch (error) {
    logger.warn({ event: "log.message_delete_failed", guildId: message.guildId, messageId: message.id, error });
  }
}

export async function handleMessageUpdate(before: Message | PartialMessage, after: Message | PartialMessage, api: OnyxApiClient) {
  if (!after.inGuild() || after.author?.bot || before.content === after.content) return;
  try {
    const channel = await logChannel(after.guildId, api, "messages", after.guild);
    if (!channel) return;
    await channel.send({
      embeds: [new EmbedBuilder().setColor(0x9a8157).setTitle("Message edited").addFields(
        { name: "Before", value: clipped(before.content), inline: false },
        { name: "After", value: clipped(after.content), inline: false },
        { name: "Context", value: `${after.author ?? "Unknown member"} in <#${after.channelId}> · [Open message](${after.url})`, inline: false },
      ).setTimestamp()],
      allowedMentions: { parse: [] },
    });
  } catch (error) {
    logger.warn({ event: "log.message_update_failed", guildId: after.guildId, messageId: after.id, error });
  }
}

export async function handleRoleChange(kind: "created" | "updated" | "deleted", role: Role, api: OnyxApiClient) {
  try {
    const channel = await logChannel(role.guild.id, api, "server", role.guild);
    if (!channel) return;
    await channel.send({ embeds: [new EmbedBuilder().setColor(0x596678).setTitle(`Role ${kind}`).setDescription(`**${role.name}** was ${kind}.`).addFields({ name: "Role ID", value: role.id }).setTimestamp()] });
  } catch (error) {
    logger.warn({ event: "log.role_change_failed", guildId: role.guild.id, roleId: role.id, error });
  }
}

export async function handleChannelChange(kind: "created" | "updated" | "deleted", changed: GuildBasedChannel, api: OnyxApiClient) {
  try {
    const channel = await logChannel(changed.guild.id, api, "server", changed.guild);
    if (!channel) return;
    await channel.send({ embeds: [new EmbedBuilder().setColor(0x596678).setTitle(`Channel ${kind}`).setDescription(`**${changed.name}** was ${kind}.`).addFields({ name: "Channel ID", value: changed.id }).setTimestamp()] });
  } catch (error) {
    logger.warn({ event: "log.channel_change_failed", guildId: changed.guild.id, channelId: changed.id, error });
  }
}

export async function handleVoiceStateChange(before: VoiceState, after: VoiceState, api: OnyxApiClient) {
  if (before.channelId === after.channelId || after.member?.user.bot) return;
  const description = before.channelId && after.channelId
    ? `${after.member} moved from <#${before.channelId}> to <#${after.channelId}>.`
    : after.channelId ? `${after.member} joined <#${after.channelId}>.` : `${before.member} left <#${before.channelId}>.`;
  await sendGuildLog(after.guild, api, "voice", { embeds: [new EmbedBuilder().setColor(0x596678).setTitle(before.channelId && after.channelId ? "Voice channel changed" : after.channelId ? "Voice joined" : "Voice left").setDescription(description).setTimestamp()], allowedMentions: { parse: [] } });
}
