import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { moderatorNotes } from "@/db/schema";
import { recordAudit } from "@/lib/server/audit";
import { requireServiceToken } from "@/lib/server/auth";
import { ApiError, apiFailure, json, readJson } from "@/lib/server/http";
import { z } from "zod";

const snowflake = z.string().regex(/^\d{17,20}$/);
const createSchema = z.object({ guildId: snowflake, userId: snowflake, moderatorUserId: snowflake, note: z.string().min(1).max(1_000) });
const removeSchema = z.object({ guildId: snowflake, noteId: z.string().uuid(), moderatorUserId: snowflake });

export async function GET(request: Request) {
  try {
    requireServiceToken(request);
    const url = new URL(request.url);
    const guildId = url.searchParams.get("guildId") ?? "";
    const userId = url.searchParams.get("userId") ?? "";
    if (!snowflake.safeParse(guildId).success || !snowflake.safeParse(userId).success) throw new ApiError(400, "A server and member are required.", "validation_failed");
    const notes = await getDb().select().from(moderatorNotes).where(and(eq(moderatorNotes.guildId, guildId), eq(moderatorNotes.userId, userId))).orderBy(desc(moderatorNotes.createdAt)).limit(20);
    return json({ notes });
  } catch (error) {
    return apiFailure(error);
  }
}

export async function POST(request: Request) {
  try {
    requireServiceToken(request);
    const parsed = createSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(400, "The moderator note is incomplete.", "validation_failed", parsed.error.flatten());
    const note = { id: crypto.randomUUID(), ...parsed.data };
    await getDb().insert(moderatorNotes).values(note);
    await recordAudit({ guildId: note.guildId, actorUserId: note.moderatorUserId, source: "bot", action: "moderation.note_added", targetType: "user", targetId: note.userId, after: { noteId: note.id } });
    return json({ note }, { status: 201 });
  } catch (error) {
    return apiFailure(error);
  }
}

export async function DELETE(request: Request) {
  try {
    requireServiceToken(request);
    const parsed = removeSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(400, "Choose a valid moderator note.", "validation_failed", parsed.error.flatten());
    const [note] = await getDb().select().from(moderatorNotes).where(and(eq(moderatorNotes.guildId, parsed.data.guildId), eq(moderatorNotes.id, parsed.data.noteId))).limit(1);
    if (!note) throw new ApiError(404, "That moderator note was not found.", "note_not_found");
    await getDb().delete(moderatorNotes).where(eq(moderatorNotes.id, note.id));
    await recordAudit({ guildId: note.guildId, actorUserId: parsed.data.moderatorUserId, source: "bot", action: "moderation.note_removed", targetType: "user", targetId: note.userId, before: { noteId: note.id } });
    return json({ removed: true });
  } catch (error) {
    return apiFailure(error);
  }
}
