import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { guildSettings, levelProfiles } from "@/db/schema";
import { requireServiceToken } from "@/lib/server/auth";
import { ApiError, apiFailure, json } from "@/lib/server/http";
import { levelFromXp } from "@/packages/core/src/leveling";

export async function GET(request: Request) {
  try {
    requireServiceToken(request);
    const guildId = new URL(request.url).searchParams.get("guildId") ?? "";
    if (!/^\d{17,20}$/.test(guildId)) throw new ApiError(400, "A valid server is required.", "validation_failed");
    const database = getDb();
    const [rows, [settings]] = await Promise.all([
      database.select({ userId: levelProfiles.userId, xp: levelProfiles.xp, messageCount: levelProfiles.messageCount, weeklyXp: levelProfiles.weeklyXp }).from(levelProfiles).where(eq(levelProfiles.guildId, guildId)).orderBy(desc(levelProfiles.xp)).limit(10),
      database.select({ settings: guildSettings.settings }).from(guildSettings).where(eq(guildSettings.guildId, guildId)).limit(1),
    ]);
    const curve = settings?.settings.xp ?? "standard";
    return json({ leaderboard: rows.map((row, index) => ({ ...row, rank: index + 1, level: levelFromXp(row.xp, curve) })) });
  } catch (error) {
    return apiFailure(error);
  }
}
