import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { appeals, guilds, moderationCases } from "@/db/schema";
import { requireCsrf, requireSession } from "@/lib/server/auth";
import { ApiError, apiFailure, json, readJson } from "@/lib/server/http";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { appealSubmissionSchema } from "@/packages/core/src/validation";

export async function GET(request: Request) {
  try {
    const session = await requireSession(request);
    const database = getDb();
    const [eligible, submitted] = await Promise.all([
      database
        .select({
          caseId: moderationCases.id,
          caseNumber: moderationCases.caseNumber,
          guildId: moderationCases.guildId,
          guildName: guilds.name,
          action: moderationCases.action,
          reason: moderationCases.reason,
          createdAt: moderationCases.createdAt,
          expiresAt: moderationCases.expiresAt,
        })
        .from(moderationCases)
        .innerJoin(guilds, eq(guilds.id, moderationCases.guildId))
        .where(
          and(
            eq(moderationCases.targetUserId, session.userId),
            eq(moderationCases.active, true),
            inArray(moderationCases.action, ["ban", "tempban", "warn", "timeout", "warning_ban", "warning_timeout"]),
          ),
        )
        .orderBy(desc(moderationCases.createdAt))
        .limit(50),
      database
        .select({
          id: appeals.id,
          caseId: appeals.caseId,
          status: appeals.status,
          decisionReason: appeals.decisionReason,
          createdAt: appeals.createdAt,
          updatedAt: appeals.updatedAt,
        })
        .from(appeals)
        .where(eq(appeals.appellantUserId, session.userId))
        .orderBy(desc(appeals.createdAt))
        .limit(50),
    ]);
    return json({ eligible, appeals: submitted });
  } catch (error) {
    return apiFailure(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession(request);
    requireCsrf(request, session);
    await enforceRateLimit(`appeal:${session.userId}`, 3, 24 * 60 * 60 * 1_000);
    const parsed = appealSubmissionSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(400, "Review your appeal and try again.", "validation_failed", parsed.error.flatten());
    const [moderationCase] = await getDb()
      .select()
      .from(moderationCases)
      .where(and(eq(moderationCases.id, parsed.data.caseId), eq(moderationCases.targetUserId, session.userId), eq(moderationCases.active, true)))
      .limit(1);
    if (!moderationCase) throw new ApiError(404, "That moderation action is not eligible for an appeal.", "case_not_eligible");
    const id = crypto.randomUUID();
    try {
      await getDb().insert(appeals).values({
        id,
        guildId: moderationCase.guildId,
        caseId: moderationCase.id,
        appellantUserId: session.userId,
        statement: parsed.data.statement,
        context: parsed.data.context,
      });
    } catch {
      throw new ApiError(409, "You already submitted an appeal for this moderation action.", "appeal_exists");
    }
    return json({ appeal: { id, status: "pending" } }, { status: 201 });
  } catch (error) {
    return apiFailure(error);
  }
}
