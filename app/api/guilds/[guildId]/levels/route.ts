import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { guildSettings, levelRoles } from "@/db/schema";
import { recordAudit } from "@/lib/server/audit";
import { requireCsrf, requireGuildAccess } from "@/lib/server/auth";
import { ApiError, apiFailure, json, readJson } from "@/lib/server/http";
import { z } from "zod";

type Context = { params: Promise<{ guildId: string }> };
const snowflake = z.string().regex(/^\d{17,20}$/);
const messageTemplate = z.object({ content: z.string().max(2_000).optional(), title: z.string().max(256).optional(), description: z.string().max(4_096).optional(), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(), footer: z.string().max(2_048).optional() });
const updateSchema = z.object({
  rewards: z.array(z.object({ level: z.number().int().min(1).max(1_000), roleId: snowflake, stack: z.boolean() })).max(50),
  xp: z.object({ cooldownSeconds: z.number().int().min(15).max(600), minimumMessageLength: z.number().int().min(3).max(200), minAward: z.number().int().min(1).max(100), maxAward: z.number().int().min(1).max(200), excludedChannelIds: z.array(snowflake).max(100), excludedRoleIds: z.array(snowflake).max(100) }).refine((value) => value.minAward <= value.maxAward, "Minimum XP cannot exceed maximum XP."),
  levelAnnouncementChannelId: snowflake.optional(),
  levelUpMessage: messageTemplate.optional(),
}).refine((value) => new Set(value.rewards.map((reward) => reward.level)).size === value.rewards.length, "Each level can have only one role reward.");

export async function GET(request: Request, context: Context) {
  try {
    const { guildId } = await context.params;
    await requireGuildAccess(request, guildId);
    const database = getDb();
    const [rewards, [settings]] = await Promise.all([database.select().from(levelRoles).where(eq(levelRoles.guildId, guildId)), database.select().from(guildSettings).where(eq(guildSettings.guildId, guildId)).limit(1)]);
    return json({ rewards: rewards.sort((left, right) => left.level - right.level), xp: settings?.settings.xp ?? { cooldownSeconds: 60, minimumMessageLength: 8, minAward: 10, maxAward: 20, excludedChannelIds: [], excludedRoleIds: [] }, levelAnnouncementChannelId: settings?.settings.levelAnnouncementChannelId, levelUpMessage: settings?.settings.messages?.levelUp });
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
    if (!parsed.success) throw new ApiError(400, "Review the level role rewards and try again.", "validation_failed", parsed.error.flatten());
    const database = getDb();
    const [before, [currentSettings]] = await Promise.all([database.select().from(levelRoles).where(eq(levelRoles.guildId, guildId)), database.select().from(guildSettings).where(eq(guildSettings.guildId, guildId)).limit(1)]);
    if (!currentSettings) throw new ApiError(404, "Onyx settings are not initialized for this server.", "guild_not_registered");
    const nextSettings = { ...currentSettings.settings, xp: parsed.data.xp, levelAnnouncementChannelId: parsed.data.levelAnnouncementChannelId, messages: { ...currentSettings.settings.messages, levelUp: parsed.data.levelUpMessage } };
    const statements = [
      env.DB.prepare("DELETE FROM level_roles WHERE guild_id = ?1").bind(guildId),
      env.DB.prepare("UPDATE guild_settings SET settings = ?2, updated_by = ?3, version = version + 1, updated_at = ?4 WHERE guild_id = ?1").bind(guildId, JSON.stringify(nextSettings), session.userId, Date.now()),
    ];
    const now = Date.now();
    for (const reward of parsed.data.rewards) statements.push(env.DB.prepare("INSERT INTO level_roles (id, guild_id, level, role_id, stack, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)").bind(crypto.randomUUID(), guildId, reward.level, reward.roleId, reward.stack ? 1 : 0, now));
    await env.DB.batch(statements);
    const saved = await getDb().select().from(levelRoles).where(eq(levelRoles.guildId, guildId));
    await recordAudit({ guildId, actorUserId: session.userId, source: "dashboard", action: "levels.roles_updated", targetType: "level_roles", targetId: guildId, before: { rewards: before }, after: { rewards: saved } });
    return json({ rewards: saved.sort((left, right) => left.level - right.level), xp: parsed.data.xp, levelAnnouncementChannelId: parsed.data.levelAnnouncementChannelId, levelUpMessage: parsed.data.levelUpMessage });
  } catch (error) {
    return apiFailure(error);
  }
}
