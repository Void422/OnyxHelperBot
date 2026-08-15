import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { giveawayEntries, giveaways } from "@/db/schema";
import { recordAudit } from "@/lib/server/audit";
import { requireServiceToken } from "@/lib/server/auth";
import { ApiError, apiFailure, json, readJson } from "@/lib/server/http";
import { selectGiveawayWinners } from "@/packages/core/src/giveaway";
import { z } from "zod";

const snowflake = z.string().regex(/^\d{17,20}$/);
const schema = z.object({
  guildId: snowflake,
  giveawayId: z.string().uuid(),
  actorUserId: snowflake,
  action: z.enum(["end", "reroll", "pause", "resume", "edit"]),
  prize: z.string().min(1).max(256).optional(),
  description: z.string().max(2_000).nullable().optional(),
  winnerCount: z.number().int().min(1).max(20).optional(),
  endsAt: z.coerce.date().optional(),
});

function secureRandom() {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return value[0] / 4_294_967_296;
}

export async function GET(request: Request) {
  try {
    requireServiceToken(request);
    const url = new URL(request.url);
    const guildId = url.searchParams.get("guildId") ?? "";
    const giveawayId = url.searchParams.get("giveawayId");
    if (!snowflake.safeParse(guildId).success) throw new ApiError(400, "A valid server is required.", "validation_failed");
    const database = getDb();
    if (giveawayId) {
      const [giveaway] = await database.select().from(giveaways).where(and(eq(giveaways.guildId, guildId), eq(giveaways.id, giveawayId))).limit(1);
      if (!giveaway) throw new ApiError(404, "That giveaway was not found in this server.", "giveaway_not_found");
      const entries = await database.select().from(giveawayEntries).where(eq(giveawayEntries.giveawayId, giveaway.id));
      return json({ giveaway, entryCount: entries.length });
    }
    const rows = await database.select().from(giveaways).where(eq(giveaways.guildId, guildId)).orderBy(desc(giveaways.createdAt)).limit(20);
    return json({ giveaways: rows });
  } catch (error) {
    return apiFailure(error);
  }
}

export async function PATCH(request: Request) {
  try {
    requireServiceToken(request);
    const parsed = schema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(400, "The giveaway update is invalid.", "validation_failed", parsed.error.flatten());
    const database = getDb();
    const [current] = await database.select().from(giveaways).where(and(eq(giveaways.guildId, parsed.data.guildId), eq(giveaways.id, parsed.data.giveawayId))).limit(1);
    if (!current) throw new ApiError(404, "That giveaway was not found in this server.", "giveaway_not_found");
    const now = new Date();
    let patch: Partial<typeof giveaways.$inferInsert> = { updatedAt: now };
    if (parsed.data.action === "pause") {
      if (!["active", "scheduled"].includes(current.status)) throw new ApiError(409, "Only a running giveaway can be paused.", "giveaway_state_invalid");
      patch = { ...patch, status: "paused", pausedAt: now };
    }
    if (parsed.data.action === "resume") {
      if (current.status !== "paused") throw new ApiError(409, "Only a paused giveaway can be resumed.", "giveaway_state_invalid");
      const pausedFor = current.pausedAt ? now.getTime() - current.pausedAt.getTime() : 0;
      patch = { ...patch, status: "active", pausedAt: null, endsAt: new Date(current.endsAt.getTime() + pausedFor) };
    }
    if (parsed.data.action === "edit") {
      if (!["active", "scheduled", "paused"].includes(current.status)) throw new ApiError(409, "Ended giveaways cannot be edited.", "giveaway_state_invalid");
      if (parsed.data.endsAt && parsed.data.endsAt.getTime() <= Date.now() + 10_000) throw new ApiError(400, "The new end time must be in the future.", "validation_failed");
      patch = { ...patch, prize: parsed.data.prize ?? current.prize, description: parsed.data.description === undefined ? current.description : parsed.data.description, winnerCount: parsed.data.winnerCount ?? current.winnerCount, endsAt: parsed.data.endsAt ?? current.endsAt };
    }
    if (parsed.data.action === "end" || parsed.data.action === "reroll") {
      if (parsed.data.action === "end" && !["active", "scheduled", "paused"].includes(current.status)) throw new ApiError(409, "That giveaway has already ended.", "giveaway_state_invalid");
      if (parsed.data.action === "reroll" && current.status !== "ended") throw new ApiError(409, "Only an ended giveaway can be rerolled.", "giveaway_state_invalid");
      const entries = await database.select({ userId: giveawayEntries.userId, weight: giveawayEntries.weight }).from(giveawayEntries).where(and(eq(giveawayEntries.giveawayId, current.id), eq(giveawayEntries.eligible, true)));
      const pool = parsed.data.action === "reroll" ? entries.filter((entry) => !current.winnerUserIds.includes(entry.userId)) : entries;
      const winnerUserIds = selectGiveawayWinners(pool.length ? pool : entries, current.winnerCount, secureRandom);
      patch = { ...patch, status: "ended", winnerUserIds, eligibleEntryCount: entries.length, rerollCount: current.rerollCount + (parsed.data.action === "reroll" ? 1 : 0) };
    }
    const [updated] = await database.update(giveaways).set(patch).where(eq(giveaways.id, current.id)).returning();
    await recordAudit({ guildId: current.guildId, actorUserId: parsed.data.actorUserId, source: "bot", action: `giveaway.${parsed.data.action}`, targetType: "giveaway", targetId: current.id, before: current as unknown as Record<string, unknown>, after: updated as unknown as Record<string, unknown> });
    return json({ giveaway: updated });
  } catch (error) {
    return apiFailure(error);
  }
}
