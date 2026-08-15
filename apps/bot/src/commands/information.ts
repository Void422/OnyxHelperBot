import { ChannelType, EmbedBuilder, SlashCommandBuilder, time, TimestampStyles } from "discord.js";
import type { OnyxCommand } from "./types";

const banner: OnyxCommand = {
  data: new SlashCommandBuilder()
    .setName("banner")
    .setDescription("Open a member's Discord profile banner at full size.")
    .addUserOption((option) => option.setName("member").setDescription("Whose banner to view; defaults to you")),
  category: "Utilities",
  async execute({ interaction }) {
    const selected = interaction.options.getUser("member") ?? interaction.user;
    const user = await selected.fetch(true);
    const bannerUrl = user.bannerURL({ size: 4096 });
    if (!bannerUrl) {
      await interaction.reply({ content: `${user.username} does not have a profile banner.`, ephemeral: true });
      return;
    }
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(user.accentColor ?? 0x27282d).setAuthor({ name: user.globalName ?? user.username, iconURL: user.displayAvatarURL() }).setImage(bannerUrl)] });
  },
};

const roleinfo: OnyxCommand = {
  data: new SlashCommandBuilder()
    .setName("roleinfo")
    .setDescription("See useful details about a server role.")
    .addRoleOption((option) => option.setName("role").setDescription("The role to inspect").setRequired(true)),
  category: "Information",
  async execute({ interaction }) {
    const role = interaction.options.getRole("role", true);
    const permissionNames = role.permissions.toArray().slice(0, 8).map((name) => name.replace(/([a-z])([A-Z])/g, "$1 $2")).join(", ") || "No elevated permissions";
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(role.color || 0x2a2b30).setTitle(role.name).addFields(
      { name: "Members", value: role.members.size.toLocaleString(), inline: true },
      { name: "Position", value: String(role.position), inline: true },
      { name: "Mentionable", value: role.mentionable ? "Yes" : "No", inline: true },
      { name: "Created", value: time(role.createdAt, TimestampStyles.RelativeTime), inline: true },
      { name: "Role ID", value: role.id, inline: true },
      { name: "Key permissions", value: permissionNames, inline: false },
    )], allowedMentions: { parse: [] } });
  },
};

const channelinfo: OnyxCommand = {
  data: new SlashCommandBuilder()
    .setName("channelinfo")
    .setDescription("See the type, age, topic, and permissions for a channel.")
    .addChannelOption((option) => option.setName("channel").setDescription("The channel to inspect; defaults to this one")),
  category: "Information",
  async execute({ interaction }) {
    const channel = interaction.options.getChannel("channel") ?? interaction.channel;
    if (!channel || channel.isDMBased()) return void await interaction.reply({ content: "Choose a channel in this server.", ephemeral: true });
    const topic = "topic" in channel ? channel.topic : null;
    const type = ChannelType[channel.type] ?? `Type ${channel.type}`;
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x292a30).setTitle(channel.name).setDescription(topic || "No topic is set for this channel.").addFields(
      { name: "Type", value: type.replace(/^Guild/, ""), inline: true },
      { name: "Created", value: time(new Date(channel.createdTimestamp ?? Date.now()), TimestampStyles.RelativeTime), inline: true },
      { name: "Channel ID", value: channel.id, inline: true },
      ...("nsfw" in channel ? [{ name: "Age restricted", value: channel.nsfw ? "Yes" : "No", inline: true }] : []),
    )] });
  },
};

const membercount: OnyxCommand = {
  data: new SlashCommandBuilder().setName("membercount").setDescription("See the server's current member total at a glance."),
  category: "Information",
  async execute({ interaction }) {
    const bots = interaction.guild.members.cache.filter((member) => member.user.bot).size;
    const cached = interaction.guild.members.cache.size;
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x292a30).setTitle(`${interaction.guild.memberCount.toLocaleString()} members`).addFields(
      { name: "People", value: Math.max(0, cached - bots).toLocaleString(), inline: true },
      { name: "Bots", value: bots.toLocaleString(), inline: true },
      { name: "Cached now", value: cached.toLocaleString(), inline: true },
    ).setFooter({ text: "People and bot totals use Discord's current member cache." })] });
  },
};

const emojis: OnyxCommand = {
  data: new SlashCommandBuilder().setName("emojis").setDescription("Browse the custom emoji available in this server."),
  category: "Information",
  async execute({ interaction }) {
    const items = interaction.guild.emojis.cache.map((emoji) => `${emoji} \`:${emoji.name}:\``);
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x292a30).setTitle(`Server emoji · ${items.length}`).setDescription(items.length ? items.slice(0, 50).join("  ") : "This server has no custom emoji.").setFooter(items.length > 50 ? { text: `Showing 50 of ${items.length}` } : null)] });
  },
};

const stickers: OnyxCommand = {
  data: new SlashCommandBuilder().setName("stickers").setDescription("List the custom stickers available in this server."),
  category: "Information",
  async execute({ interaction }) {
    const items = interaction.guild.stickers.cache.map((sticker) => `**${sticker.name}** — ${sticker.description || "No description"}`);
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x292a30).setTitle(`Server stickers · ${items.length}`).setDescription(items.length ? items.slice(0, 30).join("\n") : "This server has no custom stickers.")] });
  },
};

const botinfo: OnyxCommand = {
  data: new SlashCommandBuilder().setName("botinfo").setDescription("See the live Onyx process and connection summary."),
  category: "Information",
  async execute({ interaction }) {
    const client = interaction.client;
    const guildMembers = client.guilds.cache.reduce((total, guild) => total + guild.memberCount, 0);
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x25262a).setAuthor({ name: client.user.username, iconURL: client.user.displayAvatarURL() }).setTitle("Onyx is operating normally").addFields(
      { name: "Servers", value: client.guilds.cache.size.toLocaleString(), inline: true },
      { name: "Members served", value: guildMembers.toLocaleString(), inline: true },
      { name: "Discord latency", value: `${client.ws.ping} ms`, inline: true },
      { name: "Started", value: time(new Date(Date.now() - client.uptime), TimestampStyles.RelativeTime), inline: true },
      { name: "Runtime", value: `Node ${process.versions.node}`, inline: true },
    ).setFooter({ text: "Onyx · discord.js" })] });
  },
};

export const informationCommands: OnyxCommand[] = [banner, roleinfo, channelinfo, membercount, emojis, stickers, botinfo];
