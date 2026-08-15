import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { guilds, guildSettings } from "@/db/schema";
import { ApiError } from "./http";

export async function requireInstalledGuild(guildId: string) {
  const [row] = await getDb()
    .select({ guild: guilds, settings: guildSettings })
    .from(guilds)
    .leftJoin(guildSettings, eq(guildSettings.guildId, guilds.id))
    .where(eq(guilds.id, guildId))
    .limit(1);
  if (!row) throw new ApiError(404, "Add Onyx to this server before changing its settings.", "bot_not_installed");
  return row;
}
