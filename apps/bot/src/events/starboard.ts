import { EmbedBuilder, type MessageReaction, type PartialMessageReaction, type PartialUser, type User } from "discord.js";
import type { OnyxApiClient } from "../api-client";
import { logger } from "../logger";

function matchesEmoji(reaction: MessageReaction | PartialMessageReaction, configured: string) {
  return configured === (reaction.emoji.id ?? reaction.emoji.name) || configured === reaction.emoji.name || configured === reaction.emoji.toString();
}

export async function handleStarboardReaction(reactionInput: MessageReaction | PartialMessageReaction, _user: User | PartialUser, api: OnyxApiClient) {
  try {
    const reaction = reactionInput.partial ? await reactionInput.fetch() : reactionInput;
    const message = reaction.message.partial ? await reaction.message.fetch() : reaction.message;
    if (!message.inGuild() || !message.author || message.author.bot) return;
    const config = await api.getGuildConfig(message.guildId);
    if (!config.settings?.enabledModules.includes("starboard")) return;
    const settings = config.settings.settings.starboard;
    if (!settings?.channelId || !matchesEmoji(reaction, settings.emoji ?? "⭐") || settings.ignoredChannelIds?.includes(message.channelId)) return;
    const users = await reaction.users.fetch();
    const starCount = settings.allowSelfStars ? users.size : users.filter((user) => user.id !== message.author.id).size;
    if (starCount < (settings.threshold ?? 3)) return;
    const starboard = await message.guild.channels.fetch(settings.channelId).catch(() => null);
    if (!starboard?.isTextBased() || starboard.isDMBased() || !("send" in starboard)) return;
    const claimed = await api.claimStarboard({ guildId: message.guildId, sourceMessageId: message.id, sourceChannelId: message.channelId, starCount });
    const emoji = settings.emoji ?? "⭐";
    if (!claimed.created && claimed.entry.starboardMessageId && "messages" in starboard) {
      const existing = await starboard.messages.fetch(claimed.entry.starboardMessageId).catch(() => null);
      if (existing) await existing.edit({ content: `${emoji} **${starCount}** · <#${message.channelId}>` });
      await api.updateStarboard({ guildId: message.guildId, sourceMessageId: message.id, sourceChannelId: message.channelId, starCount, starboardMessageId: claimed.entry.starboardMessageId });
      return;
    }
    const firstImage = message.attachments.find((attachment) => attachment.contentType?.startsWith("image/"));
    const embed = new EmbedBuilder().setColor(0xc4aa73).setAuthor({ name: message.author.username, iconURL: message.author.displayAvatarURL() }).setDescription(message.content || "Shared an attachment").addFields({ name: "Original", value: `[Open message](${message.url})` }).setTimestamp(message.createdAt);
    if (firstImage) embed.setImage(firstImage.url);
    const posted = await starboard.send({ content: `${emoji} **${starCount}** · <#${message.channelId}>`, embeds: [embed], allowedMentions: { parse: [] } });
    await api.updateStarboard({ guildId: message.guildId, sourceMessageId: message.id, sourceChannelId: message.channelId, starCount, starboardMessageId: posted.id });
  } catch (error) {
    logger.warn({ event: "starboard.reaction_failed", error });
  }
}
