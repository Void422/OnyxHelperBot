import type { MessageReaction, PartialMessageReaction, PartialUser, User } from "discord.js";
import { normalizeCountingEmoji, parseCountingNumber } from "@/packages/core/src/counting";
import type { OnyxApiClient } from "../api-client";
import { logger } from "../logger";

function matchesAcceptedEmoji(reaction: MessageReaction | PartialMessageReaction, configured: string) {
  const accepted = normalizeCountingEmoji(configured);
  return accepted === reaction.emoji.id || accepted === reaction.emoji.name || accepted === reaction.emoji.toString();
}

export async function handleCountingReaction(reactionInput: MessageReaction | PartialMessageReaction, user: User | PartialUser, api: OnyxApiClient) {
  try {
    const reaction = reactionInput.partial ? await reactionInput.fetch() : reactionInput;
    const message = reaction.message.partial ? await reaction.message.fetch() : reaction.message;
    if (!message.inGuild() || !message.author || message.author.bot) return;
    const config = await api.getGuildConfig(message.guildId);
    const settings = config.settings?.settings.counting;
    if (!settings?.enabled || !settings.channelId || !settings.validatorBotId || !settings.acceptedEmoji) return;
    if (message.channelId !== settings.channelId || user.id !== settings.validatorBotId || !matchesAcceptedEmoji(reaction, settings.acceptedEmoji)) return;
    const countNumber = parseCountingNumber(message.content);
    if (countNumber === null) return;
    const result = await api.awardCountingXp({ guildId: message.guildId, channelId: message.channelId, userId: message.author.id, messageId: message.id, countNumber, occurredAt: message.createdAt });
    if (result.awarded) logger.info({ event: "counting.xp_awarded", guildId: message.guildId, channelId: message.channelId, userId: message.author.id, messageId: message.id, countNumber, xpAward: result.xpAward, level: result.level });
  } catch (error) {
    logger.warn({ event: "counting.reaction_failed", error });
  }
}
