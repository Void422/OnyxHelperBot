import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { automodRules } from "@/db/schema";
import { recordAudit } from "@/lib/server/audit";
import { requireCsrf, requireGuildAccess } from "@/lib/server/auth";
import { ApiError, apiFailure, json, readJson } from "@/lib/server/http";
import { z } from "zod";

type Context = { params: Promise<{ guildId: string }> };
const snowflake = z.string().regex(/^\d{17,20}$/);
const kind = z.enum(["spam", "mentions", "invites", "links", "caps", "duplicate", "blocked_words", "blocked_domains", "new_account"]);
const ruleSchema = z.object({
  kind,
  enabled: z.boolean(),
  conditions: z.object({
    threshold: z.number().int().min(1).max(100).optional(),
    intervalSeconds: z.number().int().min(1).max(300).optional(),
    minimumAccountAgeDays: z.number().int().min(0).max(3_650).optional(),
    percentage: z.number().int().min(1).max(100).optional(),
    values: z.array(z.string().min(1).max(200)).max(100).optional(),
    timeoutSeconds: z.number().int().min(10).max(2_419_200).optional(),
  }),
  actions: z.array(z.enum(["delete", "warn", "timeout", "kick", "ban", "notify"])).min(1).max(6),
  exemptRoleIds: z.array(snowflake).max(100),
  exemptChannelIds: z.array(snowflake).max(100),
});
const updateSchema = z.object({ rules: z.array(ruleSchema).max(9) }).refine((value) => new Set(value.rules.map((rule) => rule.kind)).size === value.rules.length, "Each automod rule can appear only once.");

export async function GET(request: Request, context: Context) {
  try {
    const { guildId } = await context.params;
    await requireGuildAccess(request, guildId);
    const rules = await getDb().select().from(automodRules).where(eq(automodRules.guildId, guildId));
    return json({ rules });
  } catch (error) {
    return apiFailure(error);
  }
}

export async function PUT(request: Request, context: Context) {
  try {
    const { guildId } = await context.params;
    const { session } = await requireGuildAccess(request, guildId);
    requireCsrf(request, session);
    const parsed = updateSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(400, "Review the automod rules and try again.", "validation_failed", parsed.error.flatten());
    const database = getDb();
    const before = await database.select().from(automodRules).where(eq(automodRules.guildId, guildId));
    const keep = new Set(parsed.data.rules.map((rule) => rule.kind));
    for (const existing of before) if (!keep.has(existing.kind)) await database.delete(automodRules).where(and(eq(automodRules.guildId, guildId), eq(automodRules.kind, existing.kind)));
    for (const rule of parsed.data.rules) {
      await database.insert(automodRules).values({ id: crypto.randomUUID(), guildId, ...rule }).onConflictDoUpdate({
        target: [automodRules.guildId, automodRules.kind],
        set: { enabled: rule.enabled, conditions: rule.conditions, actions: rule.actions, exemptRoleIds: rule.exemptRoleIds, exemptChannelIds: rule.exemptChannelIds, updatedAt: new Date() },
      });
    }
    const saved = await database.select().from(automodRules).where(eq(automodRules.guildId, guildId));
    await recordAudit({ guildId, actorUserId: session.userId, source: "dashboard", action: "automod.rules_updated", targetType: "automod", targetId: guildId, before: { rules: before }, after: { rules: saved } });
    return json({ rules: saved });
  } catch (error) {
    return apiFailure(error);
  }
}
