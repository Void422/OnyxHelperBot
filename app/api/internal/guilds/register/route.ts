import { getDb } from "@/db";
import { guilds, guildSettings, logConfigurations } from "@/db/schema";
import { requireServiceToken } from "@/lib/server/auth";
import { ApiError, apiFailure, json, readJson } from "@/lib/server/http";
import { z } from "zod";

const inputSchema = z.object({
  id: z.string().regex(/^\d{17,20}$/),
  name: z.string().min(1).max(100),
  iconHash: z.string().nullable().optional(),
  memberCount: z.number().int().min(0).max(5_000_000),
  joinedAt: z.coerce.date(),
});

export async function POST(request: Request) {
  try {
    requireServiceToken(request);
    const parsed = inputSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(400, "The guild registration payload is invalid.", "validation_failed", parsed.error.flatten());
    const database = getDb();
    const now = new Date();
    await database
      .insert(guilds)
      .values({ ...parsed.data, botInstalled: true, updatedAt: now })
      .onConflictDoUpdate({
        target: guilds.id,
        set: { name: parsed.data.name, iconHash: parsed.data.iconHash, memberCount: parsed.data.memberCount, botInstalled: true, updatedAt: now },
      });
    await database.insert(guildSettings).values({ guildId: parsed.data.id }).onConflictDoNothing();
    await database.insert(logConfigurations).values({ guildId: parsed.data.id }).onConflictDoNothing();
    return json({ ok: true }, { status: 201 });
  } catch (error) {
    return apiFailure(error);
  }
}
