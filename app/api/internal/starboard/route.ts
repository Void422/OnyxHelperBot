import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { starboardEntries } from "@/db/schema";
import { requireServiceToken } from "@/lib/server/auth";
import { ApiError, apiFailure, json, readJson } from "@/lib/server/http";
import { z } from "zod";

const snowflake = z.string().regex(/^\d{17,20}$/);
const schema = z.object({
  guildId: snowflake,
  sourceMessageId: snowflake,
  sourceChannelId: snowflake,
  starCount: z.number().int().min(1).max(100_000),
  starboardMessageId: snowflake.optional(),
});

export async function POST(request: Request) {
  try {
    requireServiceToken(request);
    const parsed = schema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(400, "The starboard entry is invalid.", "validation_failed", parsed.error.flatten());
    const database = getDb();
    const inserted = await database.insert(starboardEntries).values(parsed.data).onConflictDoNothing().returning();
    if (inserted[0]) return json({ created: true, entry: inserted[0] }, { status: 201 });
    const [existing] = await database.select().from(starboardEntries).where(and(eq(starboardEntries.guildId, parsed.data.guildId), eq(starboardEntries.sourceMessageId, parsed.data.sourceMessageId))).limit(1);
    return json({ created: false, entry: existing });
  } catch (error) {
    return apiFailure(error);
  }
}

export async function PATCH(request: Request) {
  try {
    requireServiceToken(request);
    const parsed = schema.safeParse(await readJson(request));
    if (!parsed.success || !parsed.data.starboardMessageId) throw new ApiError(400, "The starboard update is invalid.", "validation_failed", parsed.success ? undefined : parsed.error.flatten());
    const [updated] = await getDb().update(starboardEntries).set({ starboardMessageId: parsed.data.starboardMessageId, starCount: parsed.data.starCount, updatedAt: new Date() }).where(and(eq(starboardEntries.guildId, parsed.data.guildId), eq(starboardEntries.sourceMessageId, parsed.data.sourceMessageId))).returning();
    if (!updated) throw new ApiError(404, "That starboard entry was not found.", "starboard_entry_not_found");
    return json({ entry: updated });
  } catch (error) {
    return apiFailure(error);
  }
}
