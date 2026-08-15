import { REST, Routes } from "discord.js";
import { commands } from "./commands";
import { config } from "./config";
import { logger } from "./logger";

const rest = new REST({ version: "10" }).setToken(config.DISCORD_TOKEN);
const body = commands.map((command) => command.data.toJSON());

try {
  if (config.DEVELOPMENT_GUILD_ID) {
    await rest.put(Routes.applicationGuildCommands(config.DISCORD_CLIENT_ID, config.DEVELOPMENT_GUILD_ID), { body });
    logger.info({ event: "commands.deployed", scope: "guild", guildId: config.DEVELOPMENT_GUILD_ID, count: body.length });
  } else {
    await rest.put(Routes.applicationCommands(config.DISCORD_CLIENT_ID), { body });
    logger.info({ event: "commands.deployed", scope: "global", count: body.length });
  }
} catch (error) {
  logger.fatal({ event: "commands.deployment_failed", error });
  process.exitCode = 1;
}
