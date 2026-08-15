import { and, count, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { warnings } from "@/db/schema";
import { requireServiceToken } from "@/lib/server/auth";
import { createModerationCase } from "@/lib/server/cases";
import { ApiError, apiFailure, json, readJson } from "@/lib/server/http";
import { z } from "zod";

const schema = z.object({
  guildId: z.string().regex(/^\d{17,20}$/),
  userId: z.string().regex(/^\d{17,20}$/),
  moderatorUserId: z.string().regex(/^\d{17,20}$/),
  reason: z.string().min(1).max(1_000),
  expiresAt: z.coerce.date().optional(),
});

export async function POST(request: Request) {
  try {
    requireServiceToken(request);
    const parsed = schema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(400, "The warning record is incomplete.", "validation_failed", parsed.error.flatten());
    const moderationCase = await createModerationCase({
      guildId: parsed.data.guildId,
      targetUserId: parsed.data.userId,
      moderatorUserId: parsed.data.moderatorUserId,
      action: "warn",
      reason: parsed.data.reason,
      expiresAt: parsed.data.expiresAt,
    });
    const id = crypto.randomUUID();
    await getDb().insert(warnings).values({ id, caseId: moderationCase.id, ...parsed.data });
    const [active] = await getDb()
      .select({ value: count() })
      .from(warnings)
      .where(and(eq(warnings.guildId, parsed.data.guildId), eq(warnings.userId, parsed.data.userId), eq(warnings.active, true)));
    return json({ warning: { id, caseNumber: moderationCase.caseNumber }, activeCount: active.value }, { status: 201 });
  } catch (error) {
    return apiFailure(error);
  }
}

export async function GET(request: Request) {
  try {
    requireServiceToken(request);
    const url = new URL(request.url);
    const guildId = url.searchParams.get("guildId") ?? "";
    const userId = url.searchParams.get("userId") ?? "";
    if (!/^\d{17,20}$/.test(guildId) || !/^\d{17,20}$/.test(userId)) throw new ApiError(400, "A guild and member are required.", "validation_failed");
    const rows = await getDb()
      .select()
      .from(warnings)
      .where(and(eq(warnings.guildId, guildId), eq(warnings.userId, userId), eq(warnings.active, true)))
      .limit(50);
    return json({ warnings: rows });
  } catch (error) {
    return apiFailure(error);
  }
}
