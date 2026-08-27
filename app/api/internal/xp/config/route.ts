import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { guildSettings } from "@/db/schema";
import { recordAudit } from "@/lib/server/audit";
import { requireServiceToken } from "@/lib/server/auth";
import { ApiError, apiFailure, json, readJson } from "@/lib/server/http";
import { z } from "zod";

const snowflake = z.string().regex(/^\d{17,20}$/);
const schema = z.object({
  guildId: snowflake,
  actorUserId: snowflake,
  baseXp: z.number().int().min(1).max(10_000_000),
  growthXp: z.number().int().min(0).max(10_000_000),
  growthPercent: z.number().min(0).max(1_000),
});

export async function PUT(request: Request) {
  try {
    requireServiceToken(request);
    const parsed = schema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(400, "Review the custom XP curve and try again.", "validation_failed", parsed.error.flatten());
    const database = getDb();
    const [current] = await database.select().from(guildSettings).where(eq(guildSettings.guildId, parsed.data.guildId)).limit(1);
    if (!current) throw new ApiError(404, "Onyx is not set up for this server yet.", "guild_not_registered");
    const xp = {
      ...current.settings.xp,
      curve: "custom" as const,
      baseXp: parsed.data.baseXp,
      growthXp: parsed.data.growthXp,
      growthPercent: parsed.data.growthPercent,
    };
    await database.update(guildSettings).set({
      settings: { ...current.settings, xp },
      updatedBy: parsed.data.actorUserId,
      version: current.version + 1,
      updatedAt: new Date(),
    }).where(eq(guildSettings.guildId, parsed.data.guildId));
    await recordAudit({
      guildId: parsed.data.guildId,
      actorUserId: parsed.data.actorUserId,
      source: "bot",
      action: "levels.curve_updated",
      targetType: "level_settings",
      targetId: parsed.data.guildId,
      before: current.settings.xp ?? {},
      after: xp,
    });
    return json({ xp });
  } catch (error) {
    return apiFailure(error);
  }
}
