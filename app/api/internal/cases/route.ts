import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { moderationCases } from "@/db/schema";
import { recordAudit } from "@/lib/server/audit";
import { createModerationCase, scheduleTemporaryAction } from "@/lib/server/cases";
import { requireServiceToken } from "@/lib/server/auth";
import { ApiError, apiFailure, json, readJson } from "@/lib/server/http";
import { internalCaseSchema } from "@/packages/core/src/validation";
import { z } from "zod";

const snowflake = z.string().regex(/^\d{17,20}$/);
const updateSchema = z.object({
  guildId: snowflake,
  caseNumber: z.number().int().positive(),
  moderatorUserId: snowflake,
  reason: z.string().min(1).max(1_000),
});

export async function POST(request: Request) {
  try {
    requireServiceToken(request);
    const parsed = internalCaseSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(400, "The moderation record is incomplete.", "validation_failed", parsed.error.flatten());
    const moderationCase = await createModerationCase(parsed.data);
    if (parsed.data.expiresAt) {
      const reversal = parsed.data.action === "ban" || parsed.data.action === "tempban" ? "unban" : parsed.data.action === "timeout" ? "untimeout" : null;
      if (reversal) {
        await scheduleTemporaryAction({
          guildId: parsed.data.guildId,
          userId: parsed.data.targetUserId,
          action: reversal,
          dueAt: parsed.data.expiresAt,
        });
      }
    }
    return json({ case: moderationCase }, { status: 201 });
  } catch (error) {
    return apiFailure(error);
  }
}

export async function GET(request: Request) {
  try {
    requireServiceToken(request);
    const url = new URL(request.url);
    const guildId = url.searchParams.get("guildId") ?? "";
    const userId = url.searchParams.get("userId") ?? undefined;
    const caseNumberText = url.searchParams.get("caseNumber");
    if (!snowflake.safeParse(guildId).success || (userId && !snowflake.safeParse(userId).success)) {
      throw new ApiError(400, "A valid server and member are required.", "validation_failed");
    }
    const database = getDb();
    if (caseNumberText) {
      const caseNumber = Number(caseNumberText);
      if (!Number.isInteger(caseNumber) || caseNumber < 1) throw new ApiError(400, "Choose a valid case number.", "validation_failed");
      const [record] = await database.select().from(moderationCases).where(and(eq(moderationCases.guildId, guildId), eq(moderationCases.caseNumber, caseNumber))).limit(1);
      if (!record) throw new ApiError(404, `Case #${caseNumber} was not found.`, "case_not_found");
      return json({ case: record });
    }
    const rows = await database
      .select()
      .from(moderationCases)
      .where(userId ? and(eq(moderationCases.guildId, guildId), eq(moderationCases.targetUserId, userId)) : eq(moderationCases.guildId, guildId))
      .orderBy(desc(moderationCases.caseNumber))
      .limit(15);
    return json({ cases: rows });
  } catch (error) {
    return apiFailure(error);
  }
}

export async function PATCH(request: Request) {
  try {
    requireServiceToken(request);
    const parsed = updateSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(400, "The case update is incomplete.", "validation_failed", parsed.error.flatten());
    const database = getDb();
    const [before] = await database.select().from(moderationCases).where(and(eq(moderationCases.guildId, parsed.data.guildId), eq(moderationCases.caseNumber, parsed.data.caseNumber))).limit(1);
    if (!before) throw new ApiError(404, `Case #${parsed.data.caseNumber} was not found.`, "case_not_found");
    const [updated] = await database.update(moderationCases).set({ reason: parsed.data.reason, updatedAt: new Date() }).where(eq(moderationCases.id, before.id)).returning();
    await recordAudit({
      guildId: parsed.data.guildId,
      actorUserId: parsed.data.moderatorUserId,
      source: "bot",
      action: "moderation.reason_updated",
      targetType: "moderation_case",
      targetId: before.id,
      before: { reason: before.reason },
      after: { reason: updated.reason },
    });
    return json({ case: updated });
  } catch (error) {
    return apiFailure(error);
  }
}
