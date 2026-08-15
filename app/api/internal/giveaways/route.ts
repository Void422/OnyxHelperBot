import { getDb } from "@/db";
import { giveaways } from "@/db/schema";
import { requireServiceToken } from "@/lib/server/auth";
import { ApiError, apiFailure, json, readJson } from "@/lib/server/http";
import { giveawayCreateSchema } from "@/packages/core/src/validation";

export async function POST(request: Request) {
  try {
    requireServiceToken(request);
    const parsed = giveawayCreateSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(400, "The giveaway details are invalid.", "validation_failed", parsed.error.flatten());
    const id = crypto.randomUUID();
    await getDb().insert(giveaways).values({ id, ...parsed.data });
    return json({ giveaway: { id } }, { status: 201 });
  } catch (error) {
    return apiFailure(error);
  }
}
