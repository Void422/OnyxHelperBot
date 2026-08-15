import { MessageFlags, type Interaction } from "discord.js";
import { commandMap } from "../commands";
import { handleHelpSelect } from "../commands/utility";
import { handleTicketButton } from "../commands/tickets";
import type { OnyxApiClient } from "../api-client";
import { errorReference, PublicError } from "../errors";
import { logger } from "../logger";

const cooldowns = new Map<string, number>();

async function respondWithError(interaction: Interaction, message: string) {
  if (!interaction.isRepliable()) return;
  if (interaction.deferred || interaction.replied) await interaction.editReply({ content: message, embeds: [], components: [] });
  else await interaction.reply({ content: message, flags: MessageFlags.Ephemeral });
}

export async function handleInteraction(interaction: Interaction, api: OnyxApiClient) {
  try {
    if (interaction.isStringSelectMenu() && interaction.customId === "help:category") {
      await handleHelpSelect(interaction);
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith("giveaway:enter:")) {
      if (!interaction.inCachedGuild()) throw new PublicError("Giveaways can only be entered from inside the server.");
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const giveawayId = interaction.customId.split(":")[2];
      const member = interaction.member;
      const result = await api.enterGiveaway(giveawayId, {
        userId: interaction.user.id,
        roleIds: member.roles.cache.map((role) => role.id),
        accountCreatedAt: interaction.user.createdAt,
        joinedAt: member.joinedAt ?? new Date(),
      });
      await interaction.editReply(result.entries > 1 ? `You're entered with ${result.entries} entries.` : "You're entered. Good luck.");
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith("ticket:")) {
      await handleTicketButton(interaction, api);
      return;
    }

    if (!interaction.isChatInputCommand()) return;
    if (!interaction.inCachedGuild()) throw new PublicError("This command is only available inside a server.");
    const command = commandMap.get(interaction.commandName);
    if (!command) throw new PublicError("That command is not available on this Onyx build.");

    if (command.userPermissions?.some((permission) => !interaction.memberPermissions.has(permission))) {
      throw new PublicError("You don't have the Discord permission required for this command.");
    }
    if (command.botPermissions?.some((permission) => !interaction.appPermissions?.has(permission))) {
      throw new PublicError("Onyx is missing a Discord permission needed here. Ask an administrator to review the bot role.");
    }

    const guildConfig = await api.getGuildConfig(interaction.guildId);
    if (command.module) {
      if (!guildConfig.settings?.enabledModules.includes(command.module)) {
        throw new PublicError(`The ${command.module.replace(/_/g, " ")} module is disabled for this server.`);
      }
    }

    const subcommand = interaction.options.getSubcommand(false);
    const commandKey = subcommand ? `${interaction.commandName}.${subcommand}` : interaction.commandName;
    const override = guildConfig.settings?.settings.commandOverrides?.[commandKey] ?? guildConfig.settings?.settings.commandOverrides?.[interaction.commandName];
    if (override?.enabled === false) throw new PublicError("An administrator disabled that command for this server.");

    const cooldownKey = `${interaction.guildId}:${interaction.user.id}:${commandKey}`;
    const readyAt = cooldowns.get(cooldownKey) ?? 0;
    if (readyAt > Date.now()) throw new PublicError(`Give that command another ${Math.ceil((readyAt - Date.now()) / 1_000)} seconds.`);
    const cooldownSeconds = override?.cooldownSeconds ?? command.cooldownSeconds;
    if (cooldownSeconds) cooldowns.set(cooldownKey, Date.now() + cooldownSeconds * 1_000);

    logger.info({ event: "command.started", command: interaction.commandName, guildId: interaction.guildId, userId: interaction.user.id });
    await command.execute({ interaction, api });
    logger.info({ event: "command.completed", command: interaction.commandName, guildId: interaction.guildId, userId: interaction.user.id });
  } catch (error) {
    if (error instanceof PublicError) {
      await respondWithError(interaction, error.message);
      return;
    }
    const reference = errorReference();
    logger.error({ event: "interaction.failed", reference, error, interactionId: interaction.id });
    await respondWithError(interaction, `Something went wrong while handling that. Error reference: \`${reference}\``);
  }
}
