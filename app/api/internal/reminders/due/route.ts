import { and, asc, eq, inArray, lte } from "drizzle-orm";
import { getDb } from "@/db";
import { reminders } from "@/db/schema";
import { requireServiceToken } from "@/lib/server/auth";
import { ApiError, apiFailure, json, readJson } from "@/lib/server/http";
import { z } from "zod";

const completeSchema = z.object({ reminderId: z.string().uuid(), success: z.boolean() });

export async function POST(request: Request) {
  try {
    requireServiceToken(request);
    const database = getDb();
    const now = new Date();
    const due = await database.select().from(reminders).where(and(inArray(reminders.status, ["pending", "processing"]), lte(reminders.dueAt, now))).orderBy(asc(reminders.dueAt)).limit(20);
    const claimed = [];
    for (const reminder of due) {
      if (reminder.status === "processing" && reminder.leaseUntil && reminder.leaseUntil > now) continue;
      const rows = await database.update(reminders).set({ status: "processing", leaseUntil: new Date(Date.now() + 60_000) }).where(eq(reminders.id, reminder.id)).returning();
      if (rows[0]) claimed.push(rows[0]);
    }
    return json({ reminders: claimed });
  } catch (error) {
    return apiFailure(error);
  }
}

export async function PATCH(request: Request) {
  try {
    requireServiceToken(request);
    const parsed = completeSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(400, "The reminder completion is invalid.", "validation_failed", parsed.error.flatten());
    await getDb().update(reminders).set({ status: parsed.data.success ? "sent" : "failed", leaseUntil: null }).where(eq(reminders.id, parsed.data.reminderId));
    return json({ ok: true });
  } catch (error) {
    return apiFailure(error);
  }
}
