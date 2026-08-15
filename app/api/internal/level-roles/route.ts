import { requireServiceToken } from "@/lib/server/auth";
import { ApiError, apiFailure, json, readJson } from "@/lib/server/http";
import { saveLevelRoleLadder } from "@/lib/server/level-roles";
import { levelCurves } from "@/packages/core/src/rank-ladders";
import { z } from "zod";

const snowflake = z.string().regex(/^\d{17,20}$/);
const schema = z.object({
  guildId: snowflake,
  actorUserId: snowflake,
  curve: z.enum(levelCurves),
  rewards: z.array(z.object({ level: z.number().int().min(1).max(1_000), roleId: snowflake, stack: z.boolean() })).min(1).max(50),
});

export async function PUT(request: Request) {
  try {
    requireServiceToken(request);
    const parsed = schema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(400, "The rank ladder could not be saved.", "validation_failed", parsed.error.flatten());
    const rewards = await saveLevelRoleLadder({ ...parsed.data, source: "bot" });
    return json({ rewards, curve: parsed.data.curve });
  } catch (error) {
    return apiFailure(error);
  }
}
