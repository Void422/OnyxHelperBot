import { and, count, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { giveawayEntries, giveaways, guildSettings, levelProfiles } from "@/db/schema";
import { requireServiceToken } from "@/lib/server/auth";
import { ApiError, apiFailure, json, readJson } from "@/lib/server/http";
import { levelFromXp } from "@/packages/core/src/leveling";
import { z } from "zod";

const schema = z.object({
  userId: z.string().regex(/^\d{17,20}$/),
  roleIds: z.array(z.string().regex(/^\d{17,20}$/)).max(100),
  accountCreatedAt: z.coerce.date(),
  joinedAt: z.coerce.date(),
});

type Context = { params: Promise<{ giveawayId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    requireServiceToken(request);
    const parsed = schema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(400, "The giveaway entry could not be verified.", "validation_failed");
    const { giveawayId } = await context.params;
    const [giveaway] = await getDb().select().from(giveaways).where(eq(giveaways.id, giveawayId)).limit(1);
    if (!giveaway || giveaway.status !== "active" || giveaway.endsAt.getTime() <= Date.now()) {
      throw new ApiError(409, "This giveaway is no longer accepting entries.", "giveaway_closed");
    }
    const requirements = giveaway.requirements;
    if (requirements.excludedUserIds?.includes(parsed.data.userId)) throw new ApiError(403, "You are not eligible for this giveaway.", "giveaway_ineligible");
    if (requirements.requiredRoleIds?.length && !requirements.requiredRoleIds.some((role) => parsed.data.roleIds.includes(role))) {
      throw new ApiError(403, "You need one of the required roles to enter.", "giveaway_role_required");
    }
    if (requirements.blockedRoleIds?.some((role) => parsed.data.roleIds.includes(role))) {
      throw new ApiError(403, "One of your roles is excluded from this giveaway.", "giveaway_role_blocked");
    }
    const days = 86_400_000;
    if (requirements.minimumAccountAgeDays && Date.now() - parsed.data.accountCreatedAt.getTime() < requirements.minimumAccountAgeDays * days) {
      throw new ApiError(403, "Your Discord account is too new for this giveaway.", "giveaway_account_age");
    }
    if (requirements.minimumMembershipAgeDays && Date.now() - parsed.data.joinedAt.getTime() < requirements.minimumMembershipAgeDays * days) {
      throw new ApiError(403, "You have not been in the server long enough for this giveaway.", "giveaway_membership_age");
    }
    const database = getDb();
    const [[profile], [settings]] = await Promise.all([
      database.select().from(levelProfiles).where(and(eq(levelProfiles.guildId, giveaway.guildId), eq(levelProfiles.userId, parsed.data.userId))).limit(1),
      database.select({ settings: guildSettings.settings }).from(guildSettings).where(eq(guildSettings.guildId, giveaway.guildId)).limit(1),
    ]);
    if ((requirements.minimumXp ?? 0) > (profile?.xp ?? 0) || (requirements.minimumLevel ?? 0) > levelFromXp(profile?.xp ?? 0, settings?.settings.xp ?? "standard")) {
      throw new ApiError(403, "You have not reached the activity requirement for this giveaway.", "giveaway_activity_required");
    }
    let weight = 1;
    for (const roleId of parsed.data.roleIds) weight += requirements.roleBonusEntries?.[roleId] ?? 0;
    await database
      .insert(giveawayEntries)
      .values({ giveawayId, userId: parsed.data.userId, weight })
      .onConflictDoUpdate({ target: [giveawayEntries.giveawayId, giveawayEntries.userId], set: { weight, eligible: true, ineligibleReason: null } });
    const [total] = await database.select({ value: count() }).from(giveawayEntries).where(and(eq(giveawayEntries.giveawayId, giveawayId), eq(giveawayEntries.eligible, true)));
    return json({ entered: true, entries: weight, totalEntries: total.value, prize: giveaway.prize, endsAt: giveaway.endsAt, requirements });
  } catch (error) {
    return apiFailure(error);
  }
}
