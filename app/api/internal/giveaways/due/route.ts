import { and, asc, eq, inArray, lte } from "drizzle-orm";
import { getDb } from "@/db";
import { giveawayEntries, giveaways } from "@/db/schema";
import { recordAudit } from "@/lib/server/audit";
import { requireServiceToken } from "@/lib/server/auth";
import { apiFailure, json } from "@/lib/server/http";
import { selectGiveawayWinners } from "@/packages/core/src/giveaway";
import type { GiveawayRequirements } from "@/packages/core/src/domain";

function secureRandom() {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return value[0] / 4_294_967_296;
}

export async function POST(request: Request) {
  try {
    requireServiceToken(request);
    const database = getDb();
    const due = await database
      .select()
      .from(giveaways)
      .where(and(inArray(giveaways.status, ["active", "scheduled"]), lte(giveaways.endsAt, new Date())))
      .orderBy(asc(giveaways.endsAt))
      .limit(10);
    const ended: Array<{
      id: string;
      guildId: string;
      channelId: string;
      messageId: string | null;
      prize: string;
      winnerUserIds: string[];
      eligibleEntryCount: number;
      requirements: GiveawayRequirements;
    }> = [];

    for (const giveaway of due) {
      const claimed = await database
        .update(giveaways)
        .set({ status: "ending", updatedAt: new Date() })
        .where(and(eq(giveaways.id, giveaway.id), inArray(giveaways.status, ["active", "scheduled"])))
        .returning({ id: giveaways.id });
      if (!claimed.length) continue;
      const entries = await database
        .select({ userId: giveawayEntries.userId, weight: giveawayEntries.weight })
        .from(giveawayEntries)
        .where(and(eq(giveawayEntries.giveawayId, giveaway.id), eq(giveawayEntries.eligible, true)));
      const winnerUserIds = selectGiveawayWinners(entries, giveaway.winnerCount, secureRandom);
      await database
        .update(giveaways)
        .set({ status: "ended", winnerUserIds, eligibleEntryCount: entries.length, updatedAt: new Date() })
        .where(eq(giveaways.id, giveaway.id));
      await recordAudit({
        guildId: giveaway.guildId,
        actorUserId: "onyx-system",
        source: "system",
        action: "giveaway.ended",
        targetType: "giveaway",
        targetId: giveaway.id,
        after: { winnerUserIds, eligibleEntryCount: entries.length },
      });
      ended.push({
        id: giveaway.id,
        guildId: giveaway.guildId,
        channelId: giveaway.channelId,
        messageId: giveaway.messageId,
        prize: giveaway.prize,
        winnerUserIds,
        eligibleEntryCount: entries.length,
        requirements: giveaway.requirements,
      });
    }
    return json({ giveaways: ended });
  } catch (error) {
    return apiFailure(error);
  }
}
