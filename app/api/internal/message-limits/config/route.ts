import { env } from "cloudflare:workers";
import { and, count, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { channelMessageLimits } from "@/db/schema";
import { recordAudit } from "@/lib/server/audit";
import { requireServiceToken } from "@/lib/server/auth";
import { ApiError, apiFailure, json, readJson } from "@/lib/server/http";
import { z } from "zod";

const snowflake = z.string().regex(/^\d{17,20}$/);
const targetSchema = z.object({
  guildId: snowflake,
  channelId: snowflake,
  actorUserId: snowflake,
});
const setSchema = targetSchema.extend({ maxMessages: z.number().int().min(1).max(100_000) });

export async function PUT(request: Request) {
  try {
    requireServiceToken(request);
    const parsed = setSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(400, "Choose a channel and a message limit from 1 to 100,000.", "validation_failed", parsed.error.flatten());

    const database = getDb();
    const { guildId, channelId, actorUserId, maxMessages } = parsed.data;
    const [before] = await database.select().from(channelMessageLimits).where(and(eq(channelMessageLimits.guildId, guildId), eq(channelMessageLimits.channelId, channelId))).limit(1);
    if (!before) {
      const [result] = await database.select({ value: count() }).from(channelMessageLimits).where(eq(channelMessageLimits.guildId, guildId));
      if ((result?.value ?? 0) >= 50) throw new ApiError(400, "This server already has the maximum of 50 channel message limits.", "message_limit_capacity_reached");
    }

    const now = Date.now();
    const statements = [];
    if (!before) {
      statements.push(env.DB.prepare("DELETE FROM channel_message_counts WHERE guild_id = ?1 AND channel_id = ?2").bind(guildId, channelId));
    }
    statements.push(env.DB.prepare(`
      INSERT INTO channel_message_limits (id, guild_id, channel_id, max_messages, enabled, created_at, updated_at)
      VALUES (?1, ?2, ?3, ?4, 1, ?5, ?5)
      ON CONFLICT (guild_id, channel_id) DO UPDATE SET
        max_messages = excluded.max_messages,
        enabled = 1,
        updated_at = excluded.updated_at
    `).bind(crypto.randomUUID(), guildId, channelId, maxMessages, now));
    await env.DB.batch(statements);

    const [saved] = await database.select().from(channelMessageLimits).where(and(eq(channelMessageLimits.guildId, guildId), eq(channelMessageLimits.channelId, channelId))).limit(1);
    if (!saved) throw new ApiError(500, "The channel message limit could not be saved.", "message_limit_save_failed");
    await recordAudit({
      guildId,
      actorUserId,
      source: "bot",
      action: "message_limit.updated",
      targetType: "channel_message_limit",
      targetId: channelId,
      before: before ? { maxMessages: before.maxMessages, enabled: before.enabled } : null,
      after: { maxMessages: saved.maxMessages, enabled: saved.enabled },
    });
    return json({ limit: saved });
  } catch (error) {
    return apiFailure(error);
  }
}

export async function DELETE(request: Request) {
  try {
    requireServiceToken(request);
    const parsed = targetSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(400, "Choose a valid channel.", "validation_failed", parsed.error.flatten());

    const database = getDb();
    const { guildId, channelId, actorUserId } = parsed.data;
    const [before] = await database.select().from(channelMessageLimits).where(and(eq(channelMessageLimits.guildId, guildId), eq(channelMessageLimits.channelId, channelId))).limit(1);
    if (!before) throw new ApiError(404, "That channel does not have a message limit.", "message_limit_not_found");

    await env.DB.batch([
      env.DB.prepare("DELETE FROM channel_message_counts WHERE guild_id = ?1 AND channel_id = ?2").bind(guildId, channelId),
      env.DB.prepare("DELETE FROM channel_message_limits WHERE guild_id = ?1 AND channel_id = ?2").bind(guildId, channelId),
    ]);
    await recordAudit({
      guildId,
      actorUserId,
      source: "bot",
      action: "message_limit.removed",
      targetType: "channel_message_limit",
      targetId: channelId,
      before: { maxMessages: before.maxMessages, enabled: before.enabled },
      after: null,
    });
    return json({ removed: true });
  } catch (error) {
    return apiFailure(error);
  }
}
