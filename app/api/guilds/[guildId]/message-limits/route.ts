import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { channelMessageLimits } from "@/db/schema";
import { recordAudit } from "@/lib/server/audit";
import { requireCsrf, requireGuildAccess } from "@/lib/server/auth";
import { ApiError, apiFailure, json, readJson } from "@/lib/server/http";
import { z } from "zod";

type Context = { params: Promise<{ guildId: string }> };
const snowflake = z.string().regex(/^\d{17,20}$/);
const updateSchema = z.object({
  limits: z.array(z.object({ channelId: snowflake, maxMessages: z.number().int().min(1).max(100_000), enabled: z.boolean() })).max(50),
}).refine((value) => new Set(value.limits.map((limit) => limit.channelId)).size === value.limits.length, "Each channel can have only one message limit.");

export async function GET(request: Request, context: Context) {
  try {
    const { guildId } = await context.params;
    await requireGuildAccess(request, guildId);
    const limits = await getDb().select().from(channelMessageLimits).where(eq(channelMessageLimits.guildId, guildId));
    return json({ limits });
  } catch (error) {
    return apiFailure(error);
  }
}

export async function PUT(request: Request, context: Context) {
  try {
    const { guildId } = await context.params;
    const { session } = await requireGuildAccess(request, guildId);
    requireCsrf(request, session);
    const parsed = updateSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(400, "Review the channel message limits and try again.", "validation_failed", parsed.error.flatten());
    const database = getDb();
    const before = await database.select().from(channelMessageLimits).where(eq(channelMessageLimits.guildId, guildId));
    const now = Date.now();
    await env.DB.batch([
      env.DB.prepare("DELETE FROM channel_message_limits WHERE guild_id = ?1").bind(guildId),
      ...parsed.data.limits.map((limit) => env.DB.prepare("INSERT INTO channel_message_limits (id, guild_id, channel_id, max_messages, enabled, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)").bind(crypto.randomUUID(), guildId, limit.channelId, limit.maxMessages, limit.enabled ? 1 : 0, now)),
    ]);
    const saved = await database.select().from(channelMessageLimits).where(eq(channelMessageLimits.guildId, guildId));
    await recordAudit({ guildId, actorUserId: session.userId, source: "dashboard", action: "message_limits.updated", targetType: "channel_message_limits", targetId: guildId, before: { limits: before }, after: { limits: saved } });
    return json({ limits: saved });
  } catch (error) {
    return apiFailure(error);
  }
}
