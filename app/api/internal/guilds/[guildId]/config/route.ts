import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { automodRules, channelMessageLimits, guildSettings, levelRoles, logConfigurations } from "@/db/schema";
import { requireServiceToken } from "@/lib/server/auth";
import { apiFailure, json } from "@/lib/server/http";

type Context = { params: Promise<{ guildId: string }> };

export async function GET(request: Request, context: Context) {
  try {
    requireServiceToken(request);
    const { guildId } = await context.params;
    const database = getDb();
    const [[settings], [logs], rules, rewards, messageLimits] = await Promise.all([
      database.select().from(guildSettings).where(eq(guildSettings.guildId, guildId)).limit(1),
      database.select().from(logConfigurations).where(eq(logConfigurations.guildId, guildId)).limit(1),
      database.select().from(automodRules).where(eq(automodRules.guildId, guildId)),
      database.select().from(levelRoles).where(eq(levelRoles.guildId, guildId)),
      database.select().from(channelMessageLimits).where(eq(channelMessageLimits.guildId, guildId)),
    ]);
    return json({ settings: settings ?? null, logs: logs ?? null, automodRules: rules, levelRoles: rewards, channelMessageLimits: messageLimits });
  } catch (error) {
    return apiFailure(error);
  }
}
