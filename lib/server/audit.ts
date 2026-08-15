import { getDb } from "@/db";
import { auditLogs } from "@/db/schema";

export async function recordAudit(input: {
  guildId: string;
  actorUserId: string;
  source: "dashboard" | "bot" | "system";
  action: string;
  targetType: string;
  targetId?: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
}) {
  await getDb().insert(auditLogs).values({ id: crypto.randomUUID(), ...input });
}
