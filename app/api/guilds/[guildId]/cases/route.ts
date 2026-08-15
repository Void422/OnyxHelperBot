import { and, desc, eq, like, type SQL } from "drizzle-orm";
import { getDb } from "@/db";
import { moderationCases } from "@/db/schema";
import { requireGuildAccess } from "@/lib/server/auth";
import { ApiError, apiFailure, json } from "@/lib/server/http";

type Context = { params: Promise<{ guildId: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const { guildId } = await context.params;
    await requireGuildAccess(request, guildId);
    const url = new URL(request.url);
    const page = Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(50, Math.max(10, Number.parseInt(url.searchParams.get("limit") ?? "20", 10) || 20));
    const filters: SQL[] = [eq(moderationCases.guildId, guildId)];
    const user = url.searchParams.get("user")?.trim();
    const action = url.searchParams.get("action")?.trim();
    if (user) filters.push(eq(moderationCases.targetUserId, user));
    if (action) filters.push(like(moderationCases.action, `${action}%`));
    const rows = await getDb()
      .select()
      .from(moderationCases)
      .where(and(...filters))
      .orderBy(desc(moderationCases.caseNumber))
      .limit(limit + 1)
      .offset((page - 1) * limit);
    return json({ cases: rows.slice(0, limit), page, hasMore: rows.length > limit });
  } catch (error) {
    if (error instanceof RangeError) return apiFailure(new ApiError(400, "The selected page is not valid.", "invalid_page"));
    return apiFailure(error);
  }
}
