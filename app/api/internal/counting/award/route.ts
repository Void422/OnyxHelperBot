import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { countingEntries, countingProfiles, guildSettings } from "@/db/schema";
import { requireServiceToken } from "@/lib/server/auth";
import { ApiError, apiFailure, json, readJson } from "@/lib/server/http";
import { countingAwardForNumber, countingLevelCurve } from "@/packages/core/src/counting";
import { levelFromXp } from "@/packages/core/src/leveling";
import { z } from "zod";

const snowflake = z.string().regex(/^\d{17,20}$/);
const schema = z.object({
  guildId: snowflake,
  channelId: snowflake,
  userId: snowflake,
  messageId: snowflake,
  countNumber: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  occurredAt: z.coerce.date(),
});

export async function POST(request: Request) {
  try {
    requireServiceToken(request);
    const parsed = schema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(400, "That accepted count could not be recorded.", "validation_failed", parsed.error.flatten());
    const database = getDb();
    const [settingsRecord] = await database.select({ settings: guildSettings.settings }).from(guildSettings).where(eq(guildSettings.guildId, parsed.data.guildId)).limit(1);
    const counting = settingsRecord?.settings.counting;
    if (!counting?.enabled || !counting.channelId) throw new ApiError(409, "Counting XP is not enabled for this server.", "counting_disabled");
    if (counting.channelId !== parsed.data.channelId) throw new ApiError(400, "That count came from the wrong channel.", "counting_channel_mismatch");
    const xpAward = countingAwardForNumber(parsed.data.countNumber, counting);
    const [inserted] = await database.insert(countingEntries).values({
      messageId: parsed.data.messageId,
      guildId: parsed.data.guildId,
      channelId: parsed.data.channelId,
      userId: parsed.data.userId,
      countNumber: parsed.data.countNumber,
      xpAward,
      createdAt: parsed.data.occurredAt,
      updatedAt: parsed.data.occurredAt,
    }).onConflictDoNothing().returning({ messageId: countingEntries.messageId });
    if (inserted) {
      await database.insert(countingProfiles).values({
        guildId: parsed.data.guildId,
        userId: parsed.data.userId,
        xp: xpAward,
        acceptedCounts: 1,
        highestNumber: parsed.data.countNumber,
        lastCountAt: parsed.data.occurredAt,
      }).onConflictDoUpdate({
        target: [countingProfiles.guildId, countingProfiles.userId],
        set: {
          xp: sql`min(2000000000, ${countingProfiles.xp} + ${xpAward})`,
          acceptedCounts: sql`${countingProfiles.acceptedCounts} + 1`,
          highestNumber: sql`max(${countingProfiles.highestNumber}, ${parsed.data.countNumber})`,
          lastCountAt: parsed.data.occurredAt,
          updatedAt: new Date(),
        },
      });
    }
    const [profile] = await database.select().from(countingProfiles).where(and(eq(countingProfiles.guildId, parsed.data.guildId), eq(countingProfiles.userId, parsed.data.userId))).limit(1);
    if (!profile) throw new ApiError(500, "The counting profile could not be loaded.", "counting_profile_missing");
    return json({ awarded: Boolean(inserted), xpAward: inserted ? xpAward : 0, profile, level: levelFromXp(profile.xp, countingLevelCurve(counting)) }, { status: inserted ? 201 : 200 });
  } catch (error) {
    return apiFailure(error);
  }
}
