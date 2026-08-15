import { inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { guilds } from "@/db/schema";
import { getManageableGuilds, requireSession } from "@/lib/server/auth";
import { discordGuildIconUrl } from "@/lib/server/discord";
import { apiFailure, json } from "@/lib/server/http";

export async function GET(request: Request) {
  try {
    const session = await requireSession(request);
    const manageable = await getManageableGuilds(session);
    const installedRows = manageable.length
      ? await getDb().select({ id: guilds.id }).from(guilds).where(inArray(guilds.id, manageable.map((guild) => guild.guildId)))
      : [];
    const installed = new Set(installedRows.map((guild) => guild.id));
    return json({
      guilds: manageable.map((guild) => ({
        id: guild.guildId,
        name: guild.name,
        iconUrl: discordGuildIconUrl({ id: guild.guildId, icon: guild.iconHash }),
        owner: guild.owner,
        botInstalled: installed.has(guild.guildId),
      })),
    });
  } catch (error) {
    return apiFailure(error);
  }
}
