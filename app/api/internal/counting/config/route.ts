import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { guildSettings } from "@/db/schema";
import { recordAudit } from "@/lib/server/audit";
import { requireServiceToken } from "@/lib/server/auth";
import { ApiError, apiFailure, json, readJson } from "@/lib/server/http";
import type { CountingSettings } from "@/packages/core/src/domain";
import { z } from "zod";

const snowflake = z.string().regex(/^\d{17,20}$/);
const common = { guildId: snowflake, actorUserId: snowflake };
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("setup"), ...common, channelId: snowflake, validatorBotId: snowflake, acceptedEmoji: z.string().min(1).max(100) }),
  z.object({ action: z.literal("rewards"), ...common, baseAward: z.number().int().min(0).max(1_000_000), bonusEvery: z.number().int().min(1).max(2_000_000_000), bonusAward: z.number().int().min(0).max(1_000_000), maximumAward: z.number().int().min(0).max(2_000_000_000) }),
  z.object({ action: z.literal("curve"), ...common, levelBaseXp: z.number().int().min(1).max(10_000_000), levelGrowthXp: z.number().int().min(0).max(10_000_000), levelGrowthPercent: z.number().min(0).max(1_000) }),
  z.object({ action: z.literal("disable"), ...common }),
]);

export async function PUT(request: Request) {
  try {
    requireServiceToken(request);
    const parsed = schema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(400, "Review the counting settings and try again.", "validation_failed", parsed.error.flatten());
    const database = getDb();
    const [current] = await database.select().from(guildSettings).where(eq(guildSettings.guildId, parsed.data.guildId)).limit(1);
    if (!current) throw new ApiError(404, "Onyx is not set up for this server yet.", "guild_not_registered");
    const before = current.settings.counting ?? {};
    let counting: CountingSettings;
    switch (parsed.data.action) {
      case "setup":
        counting = { ...before, enabled: true, channelId: parsed.data.channelId, validatorBotId: parsed.data.validatorBotId, acceptedEmoji: parsed.data.acceptedEmoji };
        break;
      case "rewards":
        counting = { ...before, baseAward: parsed.data.baseAward, bonusEvery: parsed.data.bonusEvery, bonusAward: parsed.data.bonusAward, maximumAward: parsed.data.maximumAward };
        break;
      case "curve":
        counting = { ...before, levelBaseXp: parsed.data.levelBaseXp, levelGrowthXp: parsed.data.levelGrowthXp, levelGrowthPercent: parsed.data.levelGrowthPercent };
        break;
      case "disable":
        counting = { ...before, enabled: false };
        break;
    }
    await database.update(guildSettings).set({
      settings: { ...current.settings, counting },
      updatedBy: parsed.data.actorUserId,
      version: current.version + 1,
      updatedAt: new Date(),
    }).where(eq(guildSettings.guildId, parsed.data.guildId));
    await recordAudit({
      guildId: parsed.data.guildId,
      actorUserId: parsed.data.actorUserId,
      source: "bot",
      action: `counting.${parsed.data.action}`,
      targetType: "counting_settings",
      targetId: parsed.data.guildId,
      before: before as Record<string, unknown>,
      after: counting as Record<string, unknown>,
    });
    return json({ counting });
  } catch (error) {
    return apiFailure(error);
  }
}
