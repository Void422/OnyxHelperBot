import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { appeals, moderationCases } from "@/db/schema";
import { recordAudit } from "@/lib/server/audit";
import { requireCsrf, requireGuildAccess } from "@/lib/server/auth";
import { ApiError, apiFailure, json, readJson } from "@/lib/server/http";
import { requireRuntimeValue } from "@/lib/server/runtime";
import { DiscordPermission } from "@/packages/core/src/permissions";
import { z } from "zod";

const schema = z.object({
  status: z.enum(["reviewing", "accepted", "denied", "closed", "more_information"]),
  decisionReason: z.string().min(10).max(2_000).optional(),
  internalNotes: z.string().max(4_000).optional(),
  unban: z.boolean().default(false),
});

type Context = { params: Promise<{ guildId: string; appealId: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    const { guildId, appealId } = await context.params;
    const parsed = schema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(400, "Review the appeal decision and try again.", "validation_failed", parsed.error.flatten());
    const { session } = await requireGuildAccess(request, guildId, parsed.data.unban ? DiscordPermission.Administrator : DiscordPermission.ManageGuild);
    requireCsrf(request, session);
    const [row] = await getDb()
      .select({ appeal: appeals, moderationCase: moderationCases })
      .from(appeals)
      .innerJoin(moderationCases, eq(moderationCases.id, appeals.caseId))
      .where(and(eq(appeals.id, appealId), eq(appeals.guildId, guildId)))
      .limit(1);
    if (!row) throw new ApiError(404, "That appeal could not be found.", "appeal_not_found");
    if (parsed.data.unban) {
      if (parsed.data.status !== "accepted") throw new ApiError(400, "Only an accepted appeal can lift a ban.", "invalid_unban_decision");
      const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/bans/${row.moderationCase.targetUserId}`, {
        method: "DELETE",
        headers: { authorization: `Bot ${requireRuntimeValue("DISCORD_TOKEN")}`, "x-audit-log-reason": encodeURIComponent(`Appeal ${appealId} accepted by ${session.username}`) },
      });
      if (!response.ok && response.status !== 404) throw new ApiError(502, "Discord did not lift the ban. Check the Onyx role and try again.", "discord_unban_failed");
    }
    const now = new Date();
    await getDb()
      .update(appeals)
      .set({
        status: parsed.data.status,
        reviewerUserId: session.userId,
        decisionReason: parsed.data.decisionReason,
        internalNotes: parsed.data.internalNotes,
        decidedAt: ["accepted", "denied", "closed"].includes(parsed.data.status) ? now : null,
        updatedAt: now,
      })
      .where(eq(appeals.id, appealId));
    await getDb().update(moderationCases).set({ appealStatus: parsed.data.status, active: parsed.data.unban ? false : row.moderationCase.active, updatedAt: now }).where(eq(moderationCases.id, row.moderationCase.id));
    await recordAudit({ guildId, actorUserId: session.userId, source: "dashboard", action: `appeal.${parsed.data.status}`, targetType: "appeal", targetId: appealId, before: { status: row.appeal.status }, after: { status: parsed.data.status, unbanned: parsed.data.unban } });
    return json({ ok: true });
  } catch (error) {
    return apiFailure(error);
  }
}
