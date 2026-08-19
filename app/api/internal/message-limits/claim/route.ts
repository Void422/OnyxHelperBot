import { env } from "cloudflare:workers";
import { requireServiceToken } from "@/lib/server/auth";
import { ApiError, apiFailure, json, readJson } from "@/lib/server/http";
import { isMessageWithinLimit } from "@/packages/core/src/channel-message-limits";
import { z } from "zod";

const snowflake = z.string().regex(/^\d{17,20}$/);
const claimSchema = z.object({
  guildId: snowflake,
  channelId: snowflake,
  userId: snowflake,
  seedCount: z.number().int().min(0).max(100_000).optional(),
});

export async function POST(request: Request) {
  try {
    requireServiceToken(request);
    const parsed = claimSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(400, "The channel message claim is invalid.", "validation_failed", parsed.error.flatten());
    const { guildId, channelId, userId, seedCount } = parsed.data;
    const limit = await env.DB.prepare("SELECT max_messages AS maxMessages FROM channel_message_limits WHERE guild_id = ?1 AND channel_id = ?2 AND enabled = 1 LIMIT 1").bind(guildId, channelId).first<{ maxMessages: number }>();
    if (!limit) return json({ active: false, allowed: true, messageCount: 0, maximum: null });

    if (seedCount === undefined) {
      const existing = await env.DB.prepare("SELECT message_count AS messageCount FROM channel_message_counts WHERE guild_id = ?1 AND channel_id = ?2 AND user_id = ?3 LIMIT 1").bind(guildId, channelId, userId).first<{ messageCount: number }>();
      if (!existing) return json({ active: true, needsSeed: true, maximum: limit.maxMessages });
    } else {
      const now = Date.now();
      await env.DB.prepare(`
        INSERT INTO channel_message_counts (guild_id, channel_id, user_id, message_count, created_at, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?5)
        ON CONFLICT (guild_id, channel_id, user_id) DO NOTHING
      `).bind(guildId, channelId, userId, seedCount, now).run();
    }

    const now = Date.now();
    const claimed = await env.DB.prepare(`
      UPDATE channel_message_counts
      SET message_count = message_count + 1, updated_at = ?4
      WHERE guild_id = ?1 AND channel_id = ?2 AND user_id = ?3 AND message_count < ?5
      RETURNING message_count AS messageCount
    `).bind(guildId, channelId, userId, now, limit.maxMessages).first<{ messageCount: number }>();
    if (claimed) return json({ active: true, allowed: true, messageCount: claimed.messageCount, maximum: limit.maxMessages });
    const current = await env.DB.prepare("SELECT message_count AS messageCount FROM channel_message_counts WHERE guild_id = ?1 AND channel_id = ?2 AND user_id = ?3 LIMIT 1").bind(guildId, channelId, userId).first<{ messageCount: number }>();
    if (!current) throw new ApiError(500, "Onyx could not record that channel message.", "message_claim_failed");
    return json({ active: true, allowed: isMessageWithinLimit(current.messageCount + 1, limit.maxMessages), messageCount: current.messageCount, maximum: limit.maxMessages });
  } catch (error) {
    return apiFailure(error);
  }
}
