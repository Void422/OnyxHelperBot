import { ActivityType, Client, Events, GatewayIntentBits, Partials } from "discord.js";
import { OnyxApiClient } from "./api-client";
import { handleInteraction } from "./events/interaction-create";
import { handleMessage } from "./events/message-create";
import { logger } from "./logger";

export function createOnyxClient(api: OnyxApiClient) {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildModeration,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel, Partials.GuildMember, Partials.Message, Partials.User],
    allowedMentions: { parse: [], repliedUser: false },
  });

  client.once(Events.ClientReady, async (ready) => {
    logger.info({ event: "discord.ready", userId: ready.user.id, guildCount: ready.guilds.cache.size });
    ready.user.setPresence({ status: "online", activities: [{ type: ActivityType.Watching, name: "over the community" }] });
    for (const guild of ready.guilds.cache.values()) {
      try {
        await api.registerGuild(guild);
      } catch (error) {
        logger.error({ event: "guild.registration_failed", guildId: guild.id, error });
      }
    }
  });

  client.on(Events.GuildCreate, (guild) => void api.registerGuild(guild).catch((error) => logger.error({ event: "guild.registration_failed", guildId: guild.id, error })));
  client.on(Events.InteractionCreate, (interaction) => void handleInteraction(interaction, api));
  client.on(Events.MessageCreate, (message) => void handleMessage(message, api));
  client.on(Events.Error, (error) => logger.error({ event: "discord.client_error", error }));
  client.on(Events.Warn, (message) => logger.warn({ event: "discord.warning", message }));
  return client;
}
