import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { reminders } from "@/db/schema";
import { requireServiceToken } from "@/lib/server/auth";
import { ApiError, apiFailure, json, readJson } from "@/lib/server/http";
import { z } from "zod";

const snowflake = z.string().regex(/^\d{17,20}$/);
const createSchema = z.object({ userId: snowflake, guildId: snowflake.optional(), channelId: snowflake.optional(), message: z.string().min(1).max(1_500), dueAt: z.coerce.date().refine((date) => date.getTime() > Date.now(), "The reminder time must be in the future.") });
const deleteSchema = z.object({ userId: snowflake, reminderId: z.string().uuid() });

export async function GET(request: Request) {
  try {
    requireServiceToken(request);
    const userId = new URL(request.url).searchParams.get("userId") ?? "";
    if (!snowflake.safeParse(userId).success) throw new ApiError(400, "A valid member is required.", "validation_failed");
    const rows = await getDb().select().from(reminders).where(and(eq(reminders.userId, userId), eq(reminders.status, "pending"))).orderBy(asc(reminders.dueAt)).limit(20);
    return json({ reminders: rows });
  } catch (error) {
    return apiFailure(error);
  }
}

export async function POST(request: Request) {
  try {
    requireServiceToken(request);
    const parsed = createSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(400, "The reminder is invalid.", "validation_failed", parsed.error.flatten());
    const reminder = { id: crypto.randomUUID(), ...parsed.data };
    await getDb().insert(reminders).values(reminder);
    return json({ reminder }, { status: 201 });
  } catch (error) {
    return apiFailure(error);
  }
}

export async function DELETE(request: Request) {
  try {
    requireServiceToken(request);
    const parsed = deleteSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(400, "Choose a valid reminder.", "validation_failed", parsed.error.flatten());
    const changed = await getDb().update(reminders).set({ status: "cancelled" }).where(and(eq(reminders.id, parsed.data.reminderId), eq(reminders.userId, parsed.data.userId), eq(reminders.status, "pending"))).returning({ id: reminders.id });
    if (!changed.length) throw new ApiError(404, "That active reminder was not found.", "reminder_not_found");
    return json({ removed: true });
  } catch (error) {
    return apiFailure(error);
  }
}
