import {
  ActionRowBuilder,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  type StringSelectMenuInteraction,
} from "discord.js";
import type { OnyxCommand } from "./types";
import { commandCatalog } from "./catalog";

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

const categoryDescriptions: Record<string, string> = {
  Moderation: "Cases, warnings, timeouts, bans, and channel controls",
  Administration: "Roles, announcements, channels, and staff operations",
  Community: "Member-facing community tools",
  Giveaways: "Role-gated drops, bonus tickets, and winner rewards",
  Levels: "XP progress, leaderboards, and staff adjustments",
  Tickets: "Private support channels and staff workflows",
  Utilities: "Quick tools for everyday Discord work",
  Information: "Member, server, role, and channel information",
};

function helpCategories() {
  return [...new Set(commandCatalog().map((command) => command.category))].map((category) => ({
    label: category,
    value: category.toLocaleLowerCase(),
    description: categoryDescriptions[category]?.slice(0, 100) ?? "Onyx commands",
  }));
}

function helpEmbed(category = "home") {
  const categoryName = helpCategories().find((item) => item.value === category)?.label;
  if (categoryName) {
    const entries = commandCatalog().filter((command) => command.category === categoryName).map((command) => {
      const data = command.data.toJSON();
      const subcommands = (data.options ?? []).filter((option) => option.type === 1).map((option) => option.name);
      const names = subcommands.length ? subcommands.map((name) => `\`/${data.name} ${name}\``).join(" · ") : `\`/${data.name}\``;
      return `${names}\n${data.description}`;
    });
    return new EmbedBuilder().setColor(0x2b2d31).setTitle(categoryName).setDescription(entries.join("\n\n").slice(0, 4_096)).setFooter({ text: `${entries.length} command${entries.length === 1 ? "" : "s"} in this category` });
  }
  return new EmbedBuilder()
    .setColor(0x1f2024)
    .setTitle("How can Onyx help?")
    .setDescription("Choose a category below. Commands from disabled modules stay unavailable until an administrator enables them in the dashboard.")
    .setFooter({ text: "Only use moderation tools when you have the matching Discord permission." });
}

function helpComponents() {
  return [
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder().setCustomId("help:category").setPlaceholder("Browse command categories").addOptions(helpCategories()),
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
