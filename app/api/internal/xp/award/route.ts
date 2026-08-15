import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { guildSettings, levelProfiles } from "@/db/schema";
import { requireServiceToken } from "@/lib/server/auth";
import { ApiError, apiFailure, json, readJson } from "@/lib/server/http";
import { levelFromXp } from "@/packages/core/src/leveling";
import { z } from "zod";

const schema = z.object({
  guildId: z.string().regex(/^\d{17,20}$/),
  userId: z.string().regex(/^\d{17,20}$/),
  award: z.number().int().min(1).max(200),
  occurredAt: z.coerce.date(),
});

export async function POST(request: Request) {
  try {
    requireServiceToken(request);
    const parsed = schema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(400, "The XP award is invalid.", "validation_failed", parsed.error.flatten());
    const database = getDb();
    await database
      .insert(levelProfiles)
      .values({ guildId: parsed.data.guildId, userId: parsed.data.userId, xp: parsed.data.award, weeklyXp: parsed.data.award, monthlyXp: parsed.data.award, messageCount: 1, lastXpAt: parsed.data.occurredAt })
      .onConflictDoUpdate({
        target: [levelProfiles.guildId, levelProfiles.userId],
        set: {
          xp: sql`${levelProfiles.xp} + ${parsed.data.award}`,
          weeklyXp: sql`${levelProfiles.weeklyXp} + ${parsed.data.award}`,
          monthlyXp: sql`${levelProfiles.monthlyXp} + ${parsed.data.award}`,
          messageCount: sql`${levelProfiles.messageCount} + 1`,
          lastXpAt: parsed.data.occurredAt,
          updatedAt: new Date(),
        },
      });
    const [profile] = await database
      .select()
      .from(levelProfiles)
      .where(sql`${levelProfiles.guildId} = ${parsed.data.guildId} AND ${levelProfiles.userId} = ${parsed.data.userId}`)
      .limit(1);
    const [settings] = await database.select({ settings: guildSettings.settings }).from(guildSettings).where(eq(guildSettings.guildId, parsed.data.guildId)).limit(1);
    return json({ profile, level: levelFromXp(profile.xp, settings?.settings.xp?.curve ?? "standard") });
  } catch (error) {
    return apiFailure(error);
  }
}
