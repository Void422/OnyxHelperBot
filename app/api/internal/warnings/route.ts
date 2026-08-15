import { and, count, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { moderationCases, warnings } from "@/db/schema";
import { recordAudit } from "@/lib/server/audit";
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

const removeSchema = z.object({
  guildId: z.string().regex(/^\d{17,20}$/),
  userId: z.string().regex(/^\d{17,20}$/),
  moderatorUserId: z.string().regex(/^\d{17,20}$/),
  warningId: z.string().uuid().optional(),
  clearAll: z.boolean().default(false),
}).refine((value) => value.warningId || value.clearAll, "Choose a warning or clear all warnings.");

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
      .select({
        id: warnings.id,
        caseNumber: moderationCases.caseNumber,
        reason: warnings.reason,
        moderatorUserId: warnings.moderatorUserId,
        expiresAt: warnings.expiresAt,
        createdAt: warnings.createdAt,
      })
      .from(warnings)
      .leftJoin(moderationCases, eq(warnings.caseId, moderationCases.id))
      .where(and(eq(warnings.guildId, guildId), eq(warnings.userId, userId), eq(warnings.active, true)))
      .orderBy(desc(warnings.createdAt))
      .limit(50);
    return json({ warnings: rows });
  } catch (error) {
    return apiFailure(error);
  }
}

export async function DELETE(request: Request) {
  try {
    requireServiceToken(request);
    const parsed = removeSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(400, "Choose the warning records to remove.", "validation_failed", parsed.error.flatten());
    const database = getDb();
    const predicates = [eq(warnings.guildId, parsed.data.guildId), eq(warnings.userId, parsed.data.userId), eq(warnings.active, true)];
    if (parsed.data.warningId) predicates.push(eq(warnings.id, parsed.data.warningId));
    const rows = await database.select().from(warnings).where(and(...predicates)).limit(parsed.data.clearAll ? 50 : 1);
    if (!rows.length) throw new ApiError(404, "No matching active warning was found.", "warning_not_found");
    const now = new Date();
    await database.update(warnings).set({ active: false, removedAt: now, removedBy: parsed.data.moderatorUserId, updatedAt: now }).where(inArray(warnings.id, rows.map((row) => row.id)));
    const caseIds = rows.flatMap((row) => row.caseId ? [row.caseId] : []);
    if (caseIds.length) await database.update(moderationCases).set({ active: false, updatedAt: now }).where(inArray(moderationCases.id, caseIds));
    await recordAudit({
      guildId: parsed.data.guildId,
      actorUserId: parsed.data.moderatorUserId,
      source: "bot",
      action: parsed.data.clearAll ? "warnings.cleared" : "warning.removed",
      targetType: "user",
      targetId: parsed.data.userId,
      before: { activeWarningIds: rows.map((row) => row.id) },
      after: { activeWarningIds: [] },
    });
    return json({ removedCount: rows.length });
  } catch (error) {
    return apiFailure(error);
  }
}
