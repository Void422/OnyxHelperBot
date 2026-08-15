import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { giveaways } from "@/db/schema";
import { requireServiceToken } from "@/lib/server/auth";
import { ApiError, apiFailure, json, readJson } from "@/lib/server/http";
import { z } from "zod";

type Context = { params: Promise<{ giveawayId: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    requireServiceToken(request);
    const parsed = z.object({ messageId: z.string().regex(/^\d{17,20}$/) }).safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(400, "The giveaway message is invalid.", "validation_failed");
    const { giveawayId } = await context.params;
    await getDb().update(giveaways).set({ messageId: parsed.data.messageId, updatedAt: new Date() }).where(eq(giveaways.id, giveawayId));
    return json({ ok: true });
  } catch (error) {
    return apiFailure(error);
  }
}
