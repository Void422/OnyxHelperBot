import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { guildSettings, levelRoles } from "@/db/schema";
import type { LevelCurve } from "@/packages/core/src/rank-ladders";
import { recordAudit } from "./audit";
import { ApiError } from "./http";

export interface LevelRoleInput {
  level: number;
  roleId: string;
  stack: boolean;
}

export async function saveLevelRoleLadder(input: {
  guildId: string;
  actorUserId: string;
  source: "dashboard" | "bot";
  curve: LevelCurve;
  rewards: LevelRoleInput[];
}) {
  const database = getDb();
  const [before, [currentSettings]] = await Promise.all([
    database.select().from(levelRoles).where(eq(levelRoles.guildId, input.guildId)),
    database.select().from(guildSettings).where(eq(guildSettings.guildId, input.guildId)).limit(1),
  ]);
  if (!currentSettings) throw new ApiError(404, "Onyx is not set up for this server yet.", "guild_not_registered");
  const nextSettings = {
    ...currentSettings.settings,
    xp: { ...currentSettings.settings.xp, curve: input.curve },
  };
  const now = Date.now();
  const statements = [
    env.DB.prepare("DELETE FROM level_roles WHERE guild_id = ?1").bind(input.guildId),
    env.DB.prepare("UPDATE guild_settings SET settings = ?2, updated_by = ?3, version = version + 1, updated_at = ?4 WHERE guild_id = ?1").bind(input.guildId, JSON.stringify(nextSettings), input.actorUserId, now),
    ...input.rewards.map((reward) => env.DB.prepare("INSERT INTO level_roles (id, guild_id, level, role_id, stack, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)").bind(crypto.randomUUID(), input.guildId, reward.level, reward.roleId, reward.stack ? 1 : 0, now)),
  ];
  await env.DB.batch(statements);
  const saved = await database.select().from(levelRoles).where(eq(levelRoles.guildId, input.guildId));
  await recordAudit({
    guildId: input.guildId,
    actorUserId: input.actorUserId,
    source: input.source,
    action: "levels.ladder_updated",
    targetType: "level_roles",
    targetId: input.guildId,
    before: { curve: currentSettings.settings.xp?.curve ?? "standard", rewards: before },
    after: { curve: input.curve, rewards: saved },
  });
  return saved.sort((left, right) => left.level - right.level);
}
