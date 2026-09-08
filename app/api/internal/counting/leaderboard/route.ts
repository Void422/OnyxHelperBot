import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { countingProfiles, guildSettings } from "@/db/schema";
import { requireServiceToken } from "@/lib/server/auth";
import { ApiError, apiFailure, json } from "@/lib/server/http";
import { countingLevelCurve } from "@/packages/core/src/counting";
import { levelFromXp } from "@/packages/core/src/leveling";

export async function GET(request: Request) {
  try {
    requireServiceToken(request);
    const guildId = new URL(request.url).searchParams.get("guildId") ?? "";
    if (!/^\d{17,20}$/.test(guildId)) throw new ApiError(400, "A valid server is required.", "validation_failed");
    const database = getDb();
    const [rows, [settingsRecord]] = await Promise.all([
      database.select({ userId: countingProfiles.userId, xp: countingProfiles.xp, acceptedCounts: countingProfiles.acceptedCounts, highestNumber: countingProfiles.highestNumber }).from(countingProfiles).where(eq(countingProfiles.guildId, guildId)).orderBy(desc(countingProfiles.xp), desc(countingProfiles.acceptedCounts)).limit(10),
      database.select({ settings: guildSettings.settings }).from(guildSettings).where(eq(guildSettings.guildId, guildId)).limit(1),
    ]);
    const curve = countingLevelCurve(settingsRecord?.settings.counting);
    return json({ leaderboard: rows.map((row, index) => ({ ...row, rank: index + 1, level: levelFromXp(row.xp, curve) })) });
  } catch (error) {
    return apiFailure(error);
  }
}
