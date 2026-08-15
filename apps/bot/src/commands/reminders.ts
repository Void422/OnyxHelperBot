import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from "discord.js";
import { formatDuration, parseDuration } from "@/packages/core/src/duration";
import { PublicError } from "../errors";
import type { OnyxCommand } from "./types";

const remind: OnyxCommand = {
  data: new SlashCommandBuilder()
    .setName("remind")
    .setDescription("Create and manage reminders that survive bot restarts.")
    .addSubcommand((subcommand) => subcommand.setName("create").setDescription("Ask Onyx to remind you later.")
      .addStringOption((option) => option.setName("when").setDescription("How long from now, such as 20m, 3h, or 2d").setRequired(true))
      .addStringOption((option) => option.setName("message").setDescription("What to remind you about").setRequired(true).setMaxLength(1_500))
      .addStringOption((option) => option.setName("delivery").setDescription("Where Onyx should remind you").addChoices({ name: "Direct message", value: "dm" }, { name: "This channel", value: "channel" })))
    .addSubcommand((subcommand) => subcommand.setName("list").setDescription("Review your active reminders."))
    .addSubcommand((subcommand) => subcommand.setName("delete").setDescription("Cancel one of your active reminders.").addStringOption((option) => option.setName("id").setDescription("Reminder ID from /remind list").setRequired(true).setMinLength(8).setMaxLength(36))),
  category: "Utilities",
  cooldownSeconds: 2,
  async execute({ interaction, api }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === "create") {
      const duration = parseDuration(interaction.options.getString("when", true), 365 * 86_400_000);
      if (!duration || duration < 10_000) throw new PublicError("Use a duration between 10 seconds and one year, such as `20m`, `3h`, or `2d`.");
      const delivery = interaction.options.getString("delivery") ?? "dm";
      const result = await api.createReminder({ userId: interaction.user.id, guildId: delivery === "channel" ? interaction.guildId : undefined, channelId: delivery === "channel" ? interaction.channelId : undefined, message: interaction.options.getString("message", true).trim(), dueAt: new Date(Date.now() + duration) });
      await interaction.editReply(`Reminder \`${result.reminder.id.slice(0, 8)}\` is set for ${formatDuration(duration)} from now via ${delivery === "channel" ? "this channel" : "direct message"}.`);
      return;
    }
    const result = await api.getReminders(interaction.user.id);
    if (subcommand === "list") {
      const lines = result.reminders.map((item) => `**\`${item.id.slice(0, 8)}\`** · <t:${Math.floor(new Date(item.dueAt).getTime() / 1_000)}:R>\n${item.message}`);
      await interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x292a30).setTitle("Your reminders").setDescription(lines.length ? lines.join("\n\n") : "You have no active reminders.")] });
      return;
    }
    const candidate = interaction.options.getString("id", true).toLowerCase();
    const matches = result.reminders.filter((item) => item.id.toLowerCase().startsWith(candidate));
    if (matches.length !== 1) throw new PublicError(matches.length ? "That short ID matches more than one reminder; paste the full ID." : "That active reminder was not found.");
    await api.deleteReminder(interaction.user.id, matches[0].id);
    await interaction.editReply(`Reminder \`${matches[0].id.slice(0, 8)}\` was cancelled.`);
  },
};

export const reminderCommands: OnyxCommand[] = [remind];
