import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { appeals, moderationCases } from "@/db/schema";
import { requireGuildAccess } from "@/lib/server/auth";
import { apiFailure, json } from "@/lib/server/http";

type Context = { params: Promise<{ guildId: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const { guildId } = await context.params;
    await requireGuildAccess(request, guildId);
    const rows = await getDb()
      .select({ appeal: appeals, moderationCase: moderationCases })
      .from(appeals)
      .innerJoin(moderationCases, eq(moderationCases.id, appeals.caseId))
      .where(eq(appeals.guildId, guildId))
      .orderBy(desc(appeals.createdAt))
      .limit(50);
    return json({ appeals: rows });
  } catch (error) {
    return apiFailure(error);
  }
}
