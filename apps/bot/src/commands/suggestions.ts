import { EmbedBuilder, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { PublicError } from "../errors";
import type { OnyxCommand } from "./types";

const suggest: OnyxCommand = {
  data: new SlashCommandBuilder()
    .setName("suggest")
    .setDescription("Share an idea with the server's suggestion board.")
    .addStringOption((option) => option.setName("idea").setDescription("Describe the idea and why it would help").setRequired(true).setMinLength(10).setMaxLength(2_000)),
  category: "Community",
  module: "suggestions",
  cooldownSeconds: 30,
  async execute({ interaction, api }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const config = await api.getGuildConfig(interaction.guildId, true);
    const settings = config.settings?.settings.suggestions;
    if (!settings?.channelId) throw new PublicError("The suggestion channel has not been configured yet.");
    const channel = await interaction.guild.channels.fetch(settings.channelId).catch(() => null);
    if (!channel?.isTextBased() || channel.isDMBased() || !("send" in channel)) throw new PublicError("The configured suggestion channel is unavailable.");
    const created = await api.createSuggestion({ guildId: interaction.guildId, authorUserId: interaction.user.id, content: interaction.options.getString("idea", true).trim(), anonymous: settings.anonymous ?? false });
    const message = await channel.send({ embeds: [new EmbedBuilder().setColor(0x292a30).setTitle(`Suggestion #${created.suggestion.suggestionNumber}`).setDescription(created.suggestion.content).setAuthor(settings.anonymous ? null : { name: interaction.user.globalName ?? interaction.user.username, iconURL: interaction.user.displayAvatarURL() }).setFooter({ text: "Vote below · staff can publish a decision" }).setTimestamp()] });
    await Promise.all([message.react("👍"), message.react("👎")]);
    if (settings.createThreads) await message.startThread({ name: `Suggestion #${created.suggestion.suggestionNumber}`, autoArchiveDuration: 1440 }).catch(() => undefined);
    await api.updateSuggestion({ guildId: interaction.guildId, suggestionNumber: created.suggestion.suggestionNumber, actorUserId: interaction.user.id, action: "message", messageId: message.id });
    await interaction.editReply(`Suggestion #${created.suggestion.suggestionNumber} was posted in <#${channel.id}>.`);
  },
};

const suggestion: OnyxCommand = {
  data: new SlashCommandBuilder()
    .setName("suggestion")
    .setDescription("Review or update suggestions as staff.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((subcommand) => subcommand.setName("list").setDescription("List recent suggestions and statuses."))
    .addSubcommand((subcommand) => subcommand.setName("approve").setDescription("Mark a suggestion as approved.").addIntegerOption((option) => option.setName("number").setDescription("Suggestion number").setRequired(true).setMinValue(1)).addStringOption((option) => option.setName("response").setDescription("Public staff response").setMaxLength(1_000)))
    .addSubcommand((subcommand) => subcommand.setName("deny").setDescription("Mark a suggestion as denied.").addIntegerOption((option) => option.setName("number").setDescription("Suggestion number").setRequired(true).setMinValue(1)).addStringOption((option) => option.setName("response").setDescription("Public staff response").setMaxLength(1_000)))
    .addSubcommand((subcommand) => subcommand.setName("implement").setDescription("Mark a suggestion as implemented.").addIntegerOption((option) => option.setName("number").setDescription("Suggestion number").setRequired(true).setMinValue(1)).addStringOption((option) => option.setName("response").setDescription("Public staff response").setMaxLength(1_000)))
    .addSubcommand((subcommand) => subcommand.setName("duplicate").setDescription("Mark a suggestion as a duplicate.").addIntegerOption((option) => option.setName("number").setDescription("Suggestion number").setRequired(true).setMinValue(1)).addStringOption((option) => option.setName("response").setDescription("Public staff response").setMaxLength(1_000))),
  category: "Community",
  module: "suggestions",
  userPermissions: [PermissionFlagsBits.ManageGuild],
  async execute({ interaction, api }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const subcommand = interaction.options.getSubcommand();
    const list = await api.listSuggestions(interaction.guildId);
    if (subcommand === "list") {
      const lines = list.suggestions.map((item) => `**#${item.suggestionNumber} · ${item.status}**\n${item.content.slice(0, 160)}${item.content.length > 160 ? "…" : ""}`);
      await interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x292a30).setTitle("Recent suggestions").setDescription(lines.length ? lines.join("\n\n") : "No suggestions have been submitted yet.")] });
      return;
    }
    const number = interaction.options.getInteger("number", true);
    const current = list.suggestions.find((item) => item.suggestionNumber === number);
    if (!current) throw new PublicError(`Suggestion #${number} was not found among the recent suggestions.`);
    const status = subcommand === "approve" ? "approved" : subcommand === "deny" ? "denied" : subcommand === "implement" ? "implemented" : "duplicate";
    const result = await api.updateSuggestion({ guildId: interaction.guildId, suggestionNumber: number, actorUserId: interaction.user.id, action: status, response: interaction.options.getString("response")?.trim() });
    const config = await api.getGuildConfig(interaction.guildId, true);
    const channelId = config.settings?.settings.suggestions?.channelId;
    if (channelId && result.suggestion.messageId) {
      const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
      if (channel?.isTextBased() && !channel.isDMBased() && "messages" in channel) {
        const message = await channel.messages.fetch(result.suggestion.messageId).catch(() => null);
        if (message?.embeds[0]) await message.edit({ embeds: [EmbedBuilder.from(message.embeds[0]).setColor(status === "approved" || status === "implemented" ? 0x5f8f70 : 0x8d5d5a).setFooter({ text: `${status}${result.suggestion.staffResponse ? ` · ${result.suggestion.staffResponse}` : ""}`.slice(0, 2_048) })] });
      }
    }
    await interaction.editReply(`Suggestion #${number} is now **${status}**.`);
  },
};

export const suggestionCommands: OnyxCommand[] = [suggest, suggestion];
