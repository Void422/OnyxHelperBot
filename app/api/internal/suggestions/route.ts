import { env } from "cloudflare:workers";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { suggestions } from "@/db/schema";
import { recordAudit } from "@/lib/server/audit";
import { requireServiceToken } from "@/lib/server/auth";
import { ApiError, apiFailure, json, readJson } from "@/lib/server/http";
import { z } from "zod";

const snowflake = z.string().regex(/^\d{17,20}$/);
const createSchema = z.object({ guildId: snowflake, authorUserId: snowflake, content: z.string().min(10).max(2_000), anonymous: z.boolean().default(false) });
const updateSchema = z.object({
  guildId: snowflake,
  suggestionNumber: z.number().int().positive(),
  actorUserId: snowflake,
  action: z.enum(["message", "approved", "denied", "implemented", "duplicate"]),
  messageId: snowflake.optional(),
  response: z.string().max(1_000).optional(),
});

export async function GET(request: Request) {
  try {
    requireServiceToken(request);
    const guildId = new URL(request.url).searchParams.get("guildId") ?? "";
    if (!snowflake.safeParse(guildId).success) throw new ApiError(400, "A valid server is required.", "validation_failed");
    const rows = await getDb().select().from(suggestions).where(eq(suggestions.guildId, guildId)).orderBy(desc(suggestions.suggestionNumber)).limit(20);
    return json({ suggestions: rows });
  } catch (error) {
    return apiFailure(error);
  }
}

export async function POST(request: Request) {
  try {
    requireServiceToken(request);
    const parsed = createSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(400, "The suggestion needs a little more detail.", "validation_failed", parsed.error.flatten());
    const allocation = await env.DB.prepare(`UPDATE guilds SET next_suggestion_number = next_suggestion_number + 1, updated_at = ?2 WHERE id = ?1 RETURNING next_suggestion_number - 1 AS suggestion_number`).bind(parsed.data.guildId, Date.now()).first<{ suggestion_number: number }>();
    if (!allocation) throw new ApiError(404, "Onyx is not registered in that server.", "guild_not_registered");
    const suggestion = { id: crypto.randomUUID(), suggestionNumber: allocation.suggestion_number, ...parsed.data };
    await getDb().insert(suggestions).values(suggestion);
    await recordAudit({ guildId: suggestion.guildId, actorUserId: suggestion.authorUserId, source: "bot", action: "suggestion.created", targetType: "suggestion", targetId: suggestion.id, after: { suggestionNumber: suggestion.suggestionNumber } });
    return json({ suggestion }, { status: 201 });
  } catch (error) {
    return apiFailure(error);
  }
}

export async function PATCH(request: Request) {
  try {
    requireServiceToken(request);
    const parsed = updateSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(400, "The suggestion update is invalid.", "validation_failed", parsed.error.flatten());
    const database = getDb();
    const [current] = await database.select().from(suggestions).where(and(eq(suggestions.guildId, parsed.data.guildId), eq(suggestions.suggestionNumber, parsed.data.suggestionNumber))).limit(1);
    if (!current) throw new ApiError(404, `Suggestion #${parsed.data.suggestionNumber} was not found.`, "suggestion_not_found");
    const patch = parsed.data.action === "message" ? { messageId: parsed.data.messageId, updatedAt: new Date() } : { status: parsed.data.action, staffResponse: parsed.data.response?.trim() || null, updatedAt: new Date() };
    const [updated] = await database.update(suggestions).set(patch).where(eq(suggestions.id, current.id)).returning();
    await recordAudit({ guildId: current.guildId, actorUserId: parsed.data.actorUserId, source: "bot", action: `suggestion.${parsed.data.action}`, targetType: "suggestion", targetId: current.id, before: current as unknown as Record<string, unknown>, after: updated as unknown as Record<string, unknown> });
    return json({ suggestion: updated });
  } catch (error) {
    return apiFailure(error);
  }
}
