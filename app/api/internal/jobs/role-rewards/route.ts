import { getDb } from "@/db";
import { temporaryActions } from "@/db/schema";
import { requireServiceToken } from "@/lib/server/auth";
import { ApiError, apiFailure, json, readJson } from "@/lib/server/http";
import { z } from "zod";

const snowflake = z.string().regex(/^\d{17,20}$/);
const schema = z.object({
  guildId: snowflake,
  userId: snowflake,
  roleId: snowflake,
  dueAt: z.coerce.date().refine((date) => date.getTime() > Date.now(), "The reward expiry must be in the future."),
});

export async function POST(request: Request) {
  try {
    requireServiceToken(request);
    const parsed = schema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(400, "The timed winner role could not be scheduled.", "validation_failed", parsed.error.flatten());
    await getDb().insert(temporaryActions).values({
      id: crypto.randomUUID(),
      guildId: parsed.data.guildId,
      userId: parsed.data.userId,
      action: "remove_role",
      payload: { roleId: parsed.data.roleId },
      dueAt: parsed.data.dueAt,
    });
    return json({ ok: true }, { status: 201 });
  } catch (error) {
    return apiFailure(error);
  }
}
