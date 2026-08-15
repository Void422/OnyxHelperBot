import { and, count, eq, gt } from "drizzle-orm";
import { getDb } from "@/db";
import { guildSettings, levelProfiles } from "@/db/schema";
import { recordAudit } from "@/lib/server/audit";
import { requireServiceToken } from "@/lib/server/auth";
import { ApiError, apiFailure, json, readJson } from "@/lib/server/http";
import { levelFromXp } from "@/packages/core/src/leveling";
import { z } from "zod";

const snowflake = z.string().regex(/^\d{17,20}$/);
const adjustmentSchema = z.object({
  guildId: snowflake,
  userId: snowflake,
  moderatorUserId: snowflake,
  operation: z.enum(["add", "remove", "set"]),
  amount: z.number().int().min(0).max(2_000_000_000),
  reason: z.string().min(1).max(500),
});

export async function GET(request: Request) {
  try {
    requireServiceToken(request);
    const url = new URL(request.url);
    const guildId = url.searchParams.get("guildId") ?? "";
    const userId = url.searchParams.get("userId") ?? "";
    if (!/^\d{17,20}$/.test(guildId) || !/^\d{17,20}$/.test(userId)) throw new ApiError(400, "A guild and member are required.", "validation_failed");
    const database = getDb();
    const [[profile], [settings]] = await Promise.all([
      database.select().from(levelProfiles).where(and(eq(levelProfiles.guildId, guildId), eq(levelProfiles.userId, userId))).limit(1),
      database.select({ settings: guildSettings.settings }).from(guildSettings).where(eq(guildSettings.guildId, guildId)).limit(1),
    ]);
    const xp = profile?.xp ?? 0;
    const [higher] = await database.select({ value: count() }).from(levelProfiles).where(and(eq(levelProfiles.guildId, guildId), gt(levelProfiles.xp, xp)));
    return json({ profile: { xp, messageCount: profile?.messageCount ?? 0, rank: higher.value + 1 }, level: levelFromXp(xp, settings?.settings.xp?.curve ?? "standard") });
  } catch (error) {
    return apiFailure(error);
  }
}

export async function PATCH(request: Request) {
  try {
    requireServiceToken(request);
    const parsed = adjustmentSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(400, "The XP adjustment is invalid.", "validation_failed", parsed.error.flatten());
    const database = getDb();
    const [[current], [settings]] = await Promise.all([
      database.select().from(levelProfiles).where(and(eq(levelProfiles.guildId, parsed.data.guildId), eq(levelProfiles.userId, parsed.data.userId))).limit(1),
      database.select({ settings: guildSettings.settings }).from(guildSettings).where(eq(guildSettings.guildId, parsed.data.guildId)).limit(1),
    ]);
    const beforeXp = current?.xp ?? 0;
    const nextXp = parsed.data.operation === "set" ? parsed.data.amount : parsed.data.operation === "add" ? Math.min(2_000_000_000, beforeXp + parsed.data.amount) : Math.max(0, beforeXp - parsed.data.amount);
    await database.insert(levelProfiles).values({ guildId: parsed.data.guildId, userId: parsed.data.userId, xp: nextXp }).onConflictDoUpdate({
      target: [levelProfiles.guildId, levelProfiles.userId],
      set: { xp: nextXp, updatedAt: new Date() },
    });
    await recordAudit({
      guildId: parsed.data.guildId,
      actorUserId: parsed.data.moderatorUserId,
      source: "bot",
      action: `levels.xp_${parsed.data.operation}`,
      targetType: "user",
      targetId: parsed.data.userId,
      before: { xp: beforeXp },
      after: { xp: nextXp, reason: parsed.data.reason },
    });
    return json({ profile: { xp: nextXp, messageCount: current?.messageCount ?? 0 }, level: levelFromXp(nextXp, settings?.settings.xp?.curve ?? "standard") });
  } catch (error) {
    return apiFailure(error);
  }
}
