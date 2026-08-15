import { env } from "cloudflare:workers";
import { getDb } from "@/db";
import { moderationCases, temporaryActions } from "@/db/schema";
import { ApiError } from "./http";
import { recordAudit } from "./audit";

export async function createModerationCase(input: {
  guildId: string;
  targetUserId: string;
  moderatorUserId: string;
  action: string;
  reason: string;
  durationMs?: number;
  expiresAt?: Date;
  evidence?: string[];
  automated?: boolean;
  relatedChannelId?: string;
  relatedMessageId?: string;
}) {
  const allocation = await env.DB.prepare(
    `UPDATE guilds
     SET next_case_number = next_case_number + 1, updated_at = ?2
     WHERE id = ?1
     RETURNING next_case_number - 1 AS case_number`,
  )
    .bind(input.guildId, Date.now())
    .first<{ case_number: number }>();
  if (!allocation) throw new ApiError(404, "Onyx is not registered in that server.", "guild_not_registered");

  const id = crypto.randomUUID();
  const now = new Date();
  await getDb().insert(moderationCases).values({
    id,
    guildId: input.guildId,
    caseNumber: allocation.case_number,
    targetUserId: input.targetUserId,
    moderatorUserId: input.moderatorUserId,
    action: input.action,
    reason: input.reason,
    durationMs: input.durationMs,
    expiresAt: input.expiresAt,
    evidence: input.evidence ?? [],
    automated: input.automated ?? false,
    relatedChannelId: input.relatedChannelId,
    relatedMessageId: input.relatedMessageId,
    createdAt: now,
    updatedAt: now,
  });
  await recordAudit({
    guildId: input.guildId,
    actorUserId: input.moderatorUserId,
    source: input.automated ? "system" : "bot",
    action: `moderation.${input.action}`,
    targetType: "user",
    targetId: input.targetUserId,
    after: { caseNumber: allocation.case_number, reason: input.reason, expiresAt: input.expiresAt?.toISOString() ?? null },
  });
  return { id, caseNumber: allocation.case_number };
}

export async function scheduleTemporaryAction(input: {
  guildId: string;
  userId: string;
  action: "unban" | "untimeout" | "remove_role" | "unlock_channel";
  dueAt: Date;
  payload?: Record<string, string>;
}) {
  const id = crypto.randomUUID();
  await getDb().insert(temporaryActions).values({ id, ...input, payload: input.payload ?? {} });
  return id;
}
