import { and, count, desc, eq, gte, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { appeals, auditLogs, giveaways, levelProfiles, moderationCases, tickets } from "@/db/schema";
import { requireGuildAccess } from "@/lib/server/auth";
import { requireInstalledGuild } from "@/lib/server/guild";
import { apiFailure, json } from "@/lib/server/http";

type Context = { params: Promise<{ guildId: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const { guildId } = await context.params;
    await requireGuildAccess(request, guildId);
    const record = await requireInstalledGuild(guildId);
    const since = new Date(Date.now() - 30 * 86_400_000);
    const database = getDb();
    const [[moderation], [pendingAppeals], [activeGiveaways], [openTickets], [activeMembers], recentActivity] = await Promise.all([
      database.select({ value: count() }).from(moderationCases).where(and(eq(moderationCases.guildId, guildId), gte(moderationCases.createdAt, since))),
      database.select({ value: count() }).from(appeals).where(and(eq(appeals.guildId, guildId), inArray(appeals.status, ["pending", "reviewing", "more_information"]))),
      database.select({ value: count() }).from(giveaways).where(and(eq(giveaways.guildId, guildId), inArray(giveaways.status, ["active", "paused", "scheduled"]))),
      database.select({ value: count() }).from(tickets).where(and(eq(tickets.guildId, guildId), inArray(tickets.status, ["open", "claimed"]))),
      database.select({ value: count() }).from(levelProfiles).where(and(eq(levelProfiles.guildId, guildId), gte(levelProfiles.lastXpAt, since))),
      database.select().from(auditLogs).where(eq(auditLogs.guildId, guildId)).orderBy(desc(auditLogs.createdAt)).limit(6),
    ]);
    return json({
      guild: record.guild,
      modules: record.settings?.enabledModules ?? ["moderation", "logging"],
      stats: {
        moderationActions30d: moderation.value,
        pendingAppeals: pendingAppeals.value,
        activeGiveaways: activeGiveaways.value,
        openTickets: openTickets.value,
        activeLevelMembers30d: activeMembers.value,
      },
      recentActivity,
    });
  } catch (error) {
    return apiFailure(error);
  }
}
