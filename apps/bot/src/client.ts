import { ActivityType, Client, Events, GatewayIntentBits, Partials } from "discord.js";
import { OnyxApiClient } from "./api-client";
import { handleInteraction } from "./events/interaction-create";
import { handleGuildMemberAdd, handleGuildMemberRemove } from "./events/guild-members";
import { handleChannelChange, handleMessageDelete, handleMessageUpdate, handleRoleChange, handleVoiceStateChange } from "./events/logging";
import { handleMessage } from "./events/message-create";
import { handleStarboardReaction } from "./events/starboard";
import { logger } from "./logger";

const activityTypes = { Playing: ActivityType.Playing, Watching: ActivityType.Watching, Listening: ActivityType.Listening, Competing: ActivityType.Competing } as const;

export function createOnyxClient(api: OnyxApiClient) {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.GuildModeration,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel, Partials.GuildMember, Partials.Message, Partials.Reaction, Partials.User],
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
    const primaryGuild = ready.guilds.cache.first();
    if (primaryGuild) {
      const selected = await api.getGuildConfig(primaryGuild.id, true).catch(() => null);
      const presence = selected?.settings?.settings.presence;
      const messages = presence?.messages?.filter(Boolean) ?? [];
      if (messages.length) {
        let index = 0;
        const apply = () => ready.user.setPresence({ status: presence?.status ?? "online", activities: [{ type: activityTypes[presence?.activityType ?? "Watching"], name: messages[index++ % messages.length] }] });
        apply();
        if (messages.length > 1) {
          const timer = setInterval(apply, 300_000);
          timer.unref();
        }
      }
    }
  });

  client.on(Events.GuildCreate, (guild) => void api.registerGuild(guild).catch((error) => logger.error({ event: "guild.registration_failed", guildId: guild.id, error })));
  client.on(Events.InteractionCreate, (interaction) => void handleInteraction(interaction, api));
  client.on(Events.MessageCreate, (message) => void handleMessage(message, api));
  client.on(Events.MessageReactionAdd, (reaction, user) => void handleStarboardReaction(reaction, user, api));
  client.on(Events.GuildMemberAdd, (member) => void handleGuildMemberAdd(member, api));
  client.on(Events.GuildMemberRemove, (member) => void handleGuildMemberRemove(member, api));
  client.on(Events.MessageDelete, (message) => void handleMessageDelete(message, api));
  client.on(Events.MessageUpdate, (before, after) => void handleMessageUpdate(before, after, api));
  client.on(Events.GuildRoleCreate, (role) => void handleRoleChange("created", role, api));
  client.on(Events.GuildRoleUpdate, (before, after) => void handleRoleChange("updated", after, api, before));
  client.on(Events.GuildRoleDelete, (role) => void handleRoleChange("deleted", role, api));
  client.on(Events.ChannelCreate, (channel) => channel.isDMBased() ? undefined : void handleChannelChange("created", channel, api));
  client.on(Events.ChannelUpdate, (_before, after) => after.isDMBased() ? undefined : void handleChannelChange("updated", after, api));
  client.on(Events.ChannelDelete, (channel) => channel.isDMBased() ? undefined : void handleChannelChange("deleted", channel, api));
  client.on(Events.VoiceStateUpdate, (before, after) => void handleVoiceStateChange(before, after, api));
  client.on(Events.Error, (error) => logger.error({ event: "discord.client_error", error }));
  client.on(Events.Warn, (message) => logger.warn({ event: "discord.warning", message }));
  return client;
}
