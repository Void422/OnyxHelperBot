import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { auditLogs } from "@/db/schema";
import { requireGuildAccess } from "@/lib/server/auth";
import { apiFailure, json } from "@/lib/server/http";

type Context = { params: Promise<{ guildId: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const { guildId } = await context.params;
    await requireGuildAccess(request, guildId);
    const rows = await getDb().select().from(auditLogs).where(eq(auditLogs.guildId, guildId)).orderBy(desc(auditLogs.createdAt)).limit(100);
    return json({ events: rows });
  } catch (error) {
    return apiFailure(error);
  }
}
