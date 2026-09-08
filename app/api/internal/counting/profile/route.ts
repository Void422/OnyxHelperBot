import { env } from "cloudflare:workers";
import { and, count, eq, gt } from "drizzle-orm";
import { getDb } from "@/db";
import { countingEntries, countingProfiles, guildSettings } from "@/db/schema";
import { recordAudit } from "@/lib/server/audit";
import { requireServiceToken } from "@/lib/server/auth";
import { ApiError, apiFailure, json, readJson } from "@/lib/server/http";
import { countingLevelCurve } from "@/packages/core/src/counting";
import { levelFromXp } from "@/packages/core/src/leveling";
import { z } from "zod";

const snowflake = z.string().regex(/^\d{17,20}$/);
const resetSchema = z.object({ guildId: snowflake, actorUserId: snowflake });

export async function GET(request: Request) {
  try {
    requireServiceToken(request);
    const url = new URL(request.url);
    const guildId = url.searchParams.get("guildId") ?? "";
    const userId = url.searchParams.get("userId") ?? "";
    if (!snowflake.safeParse(guildId).success || !snowflake.safeParse(userId).success) throw new ApiError(400, "A server and member are required.", "validation_failed");
    const database = getDb();
    const [[profile], [settingsRecord]] = await Promise.all([
      database.select().from(countingProfiles).where(and(eq(countingProfiles.guildId, guildId), eq(countingProfiles.userId, userId))).limit(1),
      database.select({ settings: guildSettings.settings }).from(guildSettings).where(eq(guildSettings.guildId, guildId)).limit(1),
    ]);
    const xp = profile?.xp ?? 0;
    const [higher] = await database.select({ value: count() }).from(countingProfiles).where(and(eq(countingProfiles.guildId, guildId), gt(countingProfiles.xp, xp)));
    const result = { xp, acceptedCounts: profile?.acceptedCounts ?? 0, highestNumber: profile?.highestNumber ?? 0, lastCountAt: profile?.lastCountAt ?? null, rank: higher.value + 1 };
    return json({ profile: result, level: levelFromXp(xp, countingLevelCurve(settingsRecord?.settings.counting)) });
  } catch (error) {
    return apiFailure(error);
  }
}

export async function DELETE(request: Request) {
  try {
    requireServiceToken(request);
    const parsed = resetSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(400, "The counting reset is invalid.", "validation_failed", parsed.error.flatten());
    const database = getDb();
    const [[profiles], [entries]] = await Promise.all([
      database.select({ value: count() }).from(countingProfiles).where(eq(countingProfiles.guildId, parsed.data.guildId)),
      database.select({ value: count() }).from(countingEntries).where(eq(countingEntries.guildId, parsed.data.guildId)),
    ]);
    await env.DB.batch([
      env.DB.prepare("DELETE FROM counting_entries WHERE guild_id = ?1").bind(parsed.data.guildId),
      env.DB.prepare("DELETE FROM counting_profiles WHERE guild_id = ?1").bind(parsed.data.guildId),
    ]);
    await recordAudit({ guildId: parsed.data.guildId, actorUserId: parsed.data.actorUserId, source: "bot", action: "counting.reset_all", targetType: "guild", targetId: parsed.data.guildId, before: { profiles: profiles.value, entries: entries.value }, after: { profiles: 0, entries: 0 } });
    return json({ resetProfiles: profiles.value, resetEntries: entries.value });
  } catch (error) {
    return apiFailure(error);
  }
}
