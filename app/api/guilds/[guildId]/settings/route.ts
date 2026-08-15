import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { guildSettings } from "@/db/schema";
import { recordAudit } from "@/lib/server/audit";
import { requireCsrf, requireGuildAccess } from "@/lib/server/auth";
import { requireInstalledGuild } from "@/lib/server/guild";
import { ApiError, apiFailure, json, readJson } from "@/lib/server/http";
import { settingsUpdateSchema } from "@/packages/core/src/validation";

type Context = { params: Promise<{ guildId: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const { guildId } = await context.params;
    await requireGuildAccess(request, guildId);
    const record = await requireInstalledGuild(guildId);
    return json({
      guild: record.guild,
      settings: record.settings ?? {
        guildId,
        enabledModules: ["moderation", "logging"],
        staffRoleIds: [],
        locale: "en-US",
        timezone: "UTC",
        settings: {},
        onboardingCompleted: false,
        version: 1,
      },
    });
  } catch (error) {
    return apiFailure(error);
  }
}

export async function PUT(request: Request, context: Context) {
  try {
    const { guildId } = await context.params;
    const { session } = await requireGuildAccess(request, guildId);
    requireCsrf(request, session);
    const parsed = settingsUpdateSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(400, "Review the highlighted settings and try again.", "validation_failed", parsed.error.flatten());
    const current = await requireInstalledGuild(guildId);
    const before = current.settings;
    const now = new Date();
    await getDb()
      .insert(guildSettings)
      .values({
        guildId,
        enabledModules: parsed.data.enabledModules,
        staffRoleIds: parsed.data.staffRoleIds,
        locale: parsed.data.locale,
        timezone: parsed.data.timezone,
        settings: parsed.data.settings,
        onboardingCompleted: before?.onboardingCompleted ?? false,
        updatedBy: session.userId,
        version: (before?.version ?? 0) + 1,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: guildSettings.guildId,
        set: {
          enabledModules: parsed.data.enabledModules,
          staffRoleIds: parsed.data.staffRoleIds,
          locale: parsed.data.locale,
          timezone: parsed.data.timezone,
          settings: parsed.data.settings,
          updatedBy: session.userId,
          version: (before?.version ?? 0) + 1,
          updatedAt: now,
        },
      });
    const [saved] = await getDb().select().from(guildSettings).where(eq(guildSettings.guildId, guildId)).limit(1);
    await recordAudit({
      guildId,
      actorUserId: session.userId,
      source: "dashboard",
      action: "settings.updated",
      targetType: "guild_settings",
      targetId: guildId,
      before: before ? (before as unknown as Record<string, unknown>) : null,
      after: saved as unknown as Record<string, unknown>,
    });
    return json({ settings: saved });
  } catch (error) {
    return apiFailure(error);
  }
}
