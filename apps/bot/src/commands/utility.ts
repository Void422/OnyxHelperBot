import {
  ActionRowBuilder,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  type StringSelectMenuInteraction,
} from "discord.js";
import type { OnyxCommand } from "./types";

const ping: OnyxCommand = {
  data: new SlashCommandBuilder().setName("ping").setDescription("Check whether Onyx is online and responding normally."),
  category: "Utilities",
  cooldownSeconds: 3,
  async execute({ interaction }) {
    const started = Date.now();
    await interaction.reply({ content: "Checking…", flags: MessageFlags.Ephemeral });
    await interaction.editReply(`Onyx is online. Discord: **${interaction.client.ws.ping} ms** · Response: **${Date.now() - started} ms**`);
  },
};

const uptime: OnyxCommand = {
  data: new SlashCommandBuilder().setName("uptime").setDescription("See how long this Onyx process has been running."),
  category: "Information",
  async execute({ interaction }) {
    const startedAt = Math.floor((Date.now() - interaction.client.uptime) / 1_000);
    await interaction.reply({ content: `This process started <t:${startedAt}:R>.`, flags: MessageFlags.Ephemeral });
  },
};

const avatar: OnyxCommand = {
  data: new SlashCommandBuilder()
    .setName("avatar")
    .setDescription("Open a member's Discord avatar at full size.")
    .addUserOption((option) => option.setName("member").setDescription("Whose avatar to view; defaults to you")),
  category: "Utilities",
  async execute({ interaction }) {
    const user = interaction.options.getUser("member") ?? interaction.user;
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(0x26282d).setAuthor({ name: user.globalName ?? user.username, iconURL: user.displayAvatarURL() }).setImage(user.displayAvatarURL({ size: 4096 }))],
    });
  },
};

const userinfo: OnyxCommand = {
  data: new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("View useful account and server details for a member.")
    .addUserOption((option) => option.setName("member").setDescription("Whose information to view; defaults to you")),
  category: "Information",
  async execute({ interaction }) {
    const user = interaction.options.getUser("member") ?? interaction.user;
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(member?.displayColor || 0x2b2d31)
          .setAuthor({ name: user.globalName ?? user.username, iconURL: user.displayAvatarURL() })
          .setThumbnail(user.displayAvatarURL({ size: 256 }))
          .addFields(
            { name: "Discord ID", value: user.id, inline: true },
            { name: "Account created", value: `<t:${Math.floor(user.createdTimestamp / 1_000)}:D>`, inline: true },
            { name: "Joined this server", value: member?.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1_000)}:D>` : "Not currently a member", inline: true },
            { name: "Highest role", value: member?.roles.highest.id === interaction.guildId ? "No assigned roles" : member?.roles.highest.toString() ?? "—", inline: true },
          ),
      ],
      allowedMentions: { parse: [] },
    });
  },
};

const serverinfo: OnyxCommand = {
  data: new SlashCommandBuilder().setName("serverinfo").setDescription("See a concise overview of this Discord server."),
  category: "Information",
  async execute({ interaction }) {
    const guild = interaction.guild;
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x25272b)
          .setTitle(guild.name)
          .setThumbnail(guild.iconURL({ size: 256 }))
          .addFields(
            { name: "Members", value: guild.memberCount.toLocaleString(), inline: true },
            { name: "Channels", value: guild.channels.cache.size.toLocaleString(), inline: true },
            { name: "Roles", value: (guild.roles.cache.size - 1).toLocaleString(), inline: true },
            { name: "Created", value: `<t:${Math.floor(guild.createdTimestamp / 1_000)}:D>`, inline: true },
            { name: "Owner", value: `<@${guild.ownerId}>`, inline: true },
          ),
      ],
      allowedMentions: { parse: [] },
    });
  },
};

const helpCategories = [
  { label: "Moderation", value: "moderation", description: "Cases, warnings, timeouts, bans, and channel controls" },
  { label: "Community", value: "community", description: "Giveaways and member-facing community tools" },
  { label: "Levels", value: "levels", description: "XP progress and rank tools" },
  { label: "Utilities", value: "utilities", description: "Quick Discord and server information" },
];

function helpEmbed(category = "home") {
  if (category === "moderation") return new EmbedBuilder().setColor(0x2b2d31).setTitle("Moderation").setDescription("`/ban` · `/unban` · `/kick` · `/warn` · `/warnings` · `/timeout` · `/untimeout` · `/purge` · `/lock` · `/unlock` · `/slowmode`\n\nOnyx checks both moderator and bot role hierarchy before acting. Significant actions create a server case.");
  if (category === "community") return new EmbedBuilder().setColor(0x2b2d31).setTitle("Community").setDescription("`/giveaway create`\n\nGiveaways store entries and end times outside the Discord message, so restarts do not lose them.");
  if (category === "levels") return new EmbedBuilder().setColor(0x2b2d31).setTitle("Levels").setDescription("`/rank`\n\nXP uses cooldowns, duplicate detection, and low-signal filtering. It rewards participation, not message spam.");
  if (category === "utilities") return new EmbedBuilder().setColor(0x2b2d31).setTitle("Utilities & information").setDescription("`/ping` · `/uptime` · `/avatar` · `/userinfo` · `/serverinfo`\n\nThese commands are available without staff permissions.");
  return new EmbedBuilder()
    .setColor(0x1f2024)
    .setTitle("How can Onyx help?")
    .setDescription("Choose a category below. Commands from disabled modules stay unavailable until an administrator enables them in the dashboard.")
    .setFooter({ text: "Only use moderation tools when you have the matching Discord permission." });
}

function helpComponents() {
  return [
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder().setCustomId("help:category").setPlaceholder("Browse command categories").addOptions(helpCategories),
    ),
  ];
}

const help: OnyxCommand = {
  data: new SlashCommandBuilder().setName("help").setDescription("Browse Onyx commands by category."),
  category: "Utilities",
  async execute({ interaction }) {
    await interaction.reply({ embeds: [helpEmbed()], components: helpComponents(), flags: MessageFlags.Ephemeral });
  },
};

export async function handleHelpSelect(interaction: StringSelectMenuInteraction) {
  await interaction.update({ embeds: [helpEmbed(interaction.values[0])], components: helpComponents() });
}

export const utilityCommands: OnyxCommand[] = [ping, uptime, avatar, userinfo, serverinfo, help];
