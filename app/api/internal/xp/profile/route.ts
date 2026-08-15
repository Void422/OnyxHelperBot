import { and, count, eq, gt } from "drizzle-orm";
import { getDb } from "@/db";
import { levelProfiles } from "@/db/schema";
import { requireServiceToken } from "@/lib/server/auth";
import { ApiError, apiFailure, json } from "@/lib/server/http";
import { levelFromXp } from "@/packages/core/src/leveling";

export async function GET(request: Request) {
  try {
    requireServiceToken(request);
    const url = new URL(request.url);
    const guildId = url.searchParams.get("guildId") ?? "";
    const userId = url.searchParams.get("userId") ?? "";
    if (!/^\d{17,20}$/.test(guildId) || !/^\d{17,20}$/.test(userId)) throw new ApiError(400, "A guild and member are required.", "validation_failed");
    const database = getDb();
    const [profile] = await database.select().from(levelProfiles).where(and(eq(levelProfiles.guildId, guildId), eq(levelProfiles.userId, userId))).limit(1);
    const xp = profile?.xp ?? 0;
    const [higher] = await database.select({ value: count() }).from(levelProfiles).where(and(eq(levelProfiles.guildId, guildId), gt(levelProfiles.xp, xp)));
    return json({ profile: { xp, messageCount: profile?.messageCount ?? 0, rank: higher.value + 1 }, level: levelFromXp(xp) });
  } catch (error) {
    return apiFailure(error);
  }
}
