import { ChannelType, EmbedBuilder, MessageFlags, PermissionFlagsBits, SlashCommandBuilder, type GuildTextBasedChannel, type User } from "discord.js";
import { countingAwardForNumber, countingLevelCurve, parseCountingNumber, resolveCountingSettings } from "@/packages/core/src/counting";
import { levelProgress, xpForLevel } from "@/packages/core/src/leveling";
import type { CountingSettings } from "@/packages/core/src/domain";
import { PublicError } from "../errors";
import type { OnyxCommand } from "./types";

const adminSubcommands = new Set(["setup", "rewards", "curve", "disable", "reset-all"]);

function requireAdministrator(hasPermission: boolean) {
  if (!hasPermission) throw new PublicError("Only server administrators can change counting settings or reset counting XP.");
}

function displayEmoji(guildEmoji: string, interaction: { guild: { emojis: { cache: { get(id: string): { toString(): string } | undefined } } } }) {
  return interaction.guild.emojis.cache.get(guildEmoji)?.toString() ?? guildEmoji;
}

async function detectValidator(channel: GuildTextBasedChannel, onyxUserId: string) {
  const recent = await channel.messages.fetch({ limit: 30 });
  const candidates = new Map<string, { validator: User; emoji: string; hits: number }>();
  for (const message of recent.values()) {
    if (message.author.bot || parseCountingNumber(message.content) === null) continue;
    for (const reaction of message.reactions.cache.values()) {
      const reactors = await reaction.users.fetch({ limit: 25 });
      for (const validator of reactors.values()) {
        if (!validator.bot || validator.id === onyxUserId) continue;
        const emojiKey = reaction.emoji.id ?? reaction.emoji.name;
        if (!emojiKey) continue;
        const emoji = reaction.emoji.toString();
        const key = `${validator.id}:${emojiKey}`;
        const existing = candidates.get(key);
        candidates.set(key, { validator, emoji, hits: (existing?.hits ?? 0) + 1 });
      }
    }
  }
  const winner = [...candidates.values()].sort((left, right) => right.hits - left.hits)[0];
  if (!winner || winner.hits < 2) throw new PublicError("I could not confidently identify the counting bot. Run setup again and provide both `validator` and `accepted-emoji`.");
  return winner;
}

function settingsEmbed(settings?: CountingSettings) {
  const resolved = resolveCountingSettings(settings);
  const cap = resolved.maximumAward > 0 ? `${resolved.maximumAward.toLocaleString()} XP` : "No cap";
  return new EmbedBuilder().setColor(settings?.enabled ? 0x55b686 : 0x666b73).setTitle(settings?.enabled ? "Counting XP is active" : "Counting XP is off").setDescription(settings?.channelId && settings.validatorBotId && settings.acceptedEmoji
    ? `Watching <#${settings.channelId}> for **${settings.acceptedEmoji}** reactions from <@${settings.validatorBotId}>.`
    : "Use `/counting setup` to connect the counting channel and its validator bot.")
    .addFields(
      { name: "XP per accepted count", value: `${resolved.baseAward.toLocaleString()} base · +${resolved.bonusAward.toLocaleString()} every ${resolved.bonusEvery.toLocaleString()} numbers · ${cap}`, inline: false },
      { name: "Separate level curve", value: `${resolved.levelBaseXp.toLocaleString()} XP first level · +${resolved.levelGrowthXp.toLocaleString()} and ${resolved.levelGrowthPercent}% each next level`, inline: false },
    )
    .setFooter({ text: "Counting XP never changes regular chat XP" });
}

const counting: OnyxCommand = {
  data: new SlashCommandBuilder()
    .setName("counting")
    .setDescription("Separate XP, levels, and rankings for the counting channel.")
    .addSubcommand((subcommand) => subcommand.setName("rank").setDescription("View a member's counting level and XP.").addUserOption((option) => option.setName("member").setDescription("Whose counting rank to view; defaults to you")))
    .addSubcommand((subcommand) => subcommand.setName("leaderboard").setDescription("View the ten members with the most counting XP."))
    .addSubcommand((subcommand) => subcommand.setName("status").setDescription("See how counting XP is configured."))
    .addSubcommand((subcommand) => subcommand.setName("setup").setDescription("Connect a counting channel and its existing counting bot.")
      .addChannelOption((option) => option.setName("channel").setDescription("The channel where members count").setRequired(true).addChannelTypes(ChannelType.GuildText))
      .addUserOption((option) => option.setName("validator").setDescription("Optional counting bot; leave blank to auto-detect"))
      .addStringOption((option) => option.setName("accepted-emoji").setDescription("Optional success emoji; provide it together with validator").setMaxLength(100)))
    .addSubcommand((subcommand) => subcommand.setName("rewards").setDescription("Choose how count numbers scale their XP reward.")
      .addIntegerOption((option) => option.setName("base-xp").setDescription("XP for an accepted count before bonuses").setRequired(true).setMinValue(0).setMaxValue(1_000_000))
      .addIntegerOption((option) => option.setName("increase-every").setDescription("How many channel numbers unlock the next bonus").setRequired(true).setMinValue(1).setMaxValue(2_000_000_000))
      .addIntegerOption((option) => option.setName("increase-xp").setDescription("Extra XP unlocked at each interval").setRequired(true).setMinValue(0).setMaxValue(1_000_000))
      .addIntegerOption((option) => option.setName("maximum-xp").setDescription("Maximum XP per count; use 0 for no cap").setRequired(true).setMinValue(0).setMaxValue(2_000_000_000)))
    .addSubcommand((subcommand) => subcommand.setName("curve").setDescription("Set the separate counting level curve.")
      .addIntegerOption((option) => option.setName("starting-xp").setDescription("XP needed for counting level 1").setRequired(true).setMinValue(1).setMaxValue(10_000_000))
      .addIntegerOption((option) => option.setName("flat-increase").setDescription("Fixed XP added to each next level cost").setRequired(true).setMinValue(0).setMaxValue(10_000_000))
      .addNumberOption((option) => option.setName("growth-percent").setDescription("Percent of the previous cost added each level").setRequired(true).setMinValue(0).setMaxValue(1_000)))
    .addSubcommand((subcommand) => subcommand.setName("disable").setDescription("Stop awarding counting XP without deleting anyone's progress."))
    .addSubcommand((subcommand) => subcommand.setName("reset-all").setDescription("Permanently erase all counting XP and counting history.")
      .addBooleanOption((option) => option.setName("confirm").setDescription("Choose True to confirm the permanent counting reset").setRequired(true))),
  category: "Levels",
  cooldownSeconds: 2,
  async execute({ interaction, api }) {
    const subcommand = interaction.options.getSubcommand();
    const isAdminAction = adminSubcommands.has(subcommand);
    if (isAdminAction) requireAdministrator(interaction.memberPermissions.has(PermissionFlagsBits.Administrator));
    await interaction.deferReply(isAdminAction || subcommand === "status" ? { flags: MessageFlags.Ephemeral } : {});

    if (subcommand === "setup") {
      const channel = interaction.options.getChannel("channel", true);
      if (!channel.isTextBased() || channel.isDMBased() || !("messages" in channel)) throw new PublicError("Choose a server text channel.");
      const providedValidator = interaction.options.getUser("validator");
      const providedEmoji = interaction.options.getString("accepted-emoji")?.trim();
      if (Boolean(providedValidator) !== Boolean(providedEmoji)) throw new PublicError("Provide both `validator` and `accepted-emoji`, or leave both blank so I can detect them.");
      if (providedValidator && !providedValidator.bot) throw new PublicError("The validator must be the bot that confirms correct counts.");
      const detected = providedValidator && providedEmoji
        ? { validator: providedValidator, emoji: providedEmoji, hits: 0 }
        : await detectValidator(channel, interaction.client.user.id);
      const result = await api.configureCounting({ action: "setup", guildId: interaction.guildId, actorUserId: interaction.user.id, channelId: channel.id, validatorBotId: detected.validator.id, acceptedEmoji: detected.emoji });
      const settings = resolveCountingSettings(result.counting);
      await interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x55b686).setTitle("Counting XP connected").setDescription(`Watching ${channel} for ${displayEmoji(detected.emoji, interaction)} reactions from ${detected.validator}. Only confirmed number messages earn counting XP.`).addFields(
        { name: "Starting reward", value: `${settings.baseAward.toLocaleString()} XP per accepted count`, inline: true },
        { name: "Scaling", value: `+${settings.bonusAward.toLocaleString()} XP every ${settings.bonusEvery.toLocaleString()} numbers`, inline: true },
      ).setFooter({ text: "Change rewards with /counting rewards" })], allowedMentions: { parse: [] } });
      return;
    }

    if (subcommand === "rewards") {
      const settings = {
        baseAward: interaction.options.getInteger("base-xp", true),
        bonusEvery: interaction.options.getInteger("increase-every", true),
        bonusAward: interaction.options.getInteger("increase-xp", true),
        maximumAward: interaction.options.getInteger("maximum-xp", true),
      };
      await api.configureCounting({ action: "rewards", guildId: interaction.guildId, actorUserId: interaction.user.id, ...settings });
      const examples = [1, settings.bonusEvery, settings.bonusEvery * 5].map((number) => `Count **${number.toLocaleString()}** → **${countingAwardForNumber(number, settings).toLocaleString()} XP**`);
      await interaction.editReply({ embeds: [new EmbedBuilder().setColor(0xe0aa4f).setTitle("Counting rewards updated").setDescription(examples.join("\n")).setFooter({ text: settings.maximumAward ? `Capped at ${settings.maximumAward.toLocaleString()} XP per count` : "No XP cap" })] });
      return;
    }

    if (subcommand === "curve") {
      const settings = {
        levelBaseXp: interaction.options.getInteger("starting-xp", true),
        levelGrowthXp: interaction.options.getInteger("flat-increase", true),
        levelGrowthPercent: interaction.options.getNumber("growth-percent", true),
      };
      await api.configureCounting({ action: "curve", guildId: interaction.guildId, actorUserId: interaction.user.id, ...settings });
      const curve = countingLevelCurve(settings);
      const forecast = [0, 1, 5, 10].map((level) => `**Level ${level} → ${level + 1}:** ${(xpForLevel(level + 1, curve) - xpForLevel(level, curve)).toLocaleString()} counting XP`);
      await interaction.editReply({ embeds: [new EmbedBuilder().setColor(0xe0aa4f).setTitle("Counting level curve updated").setDescription(forecast.join("\n")).setFooter({ text: "This curve is separate from regular server levels" })] });
      return;
    }

    if (subcommand === "disable") {
      await api.configureCounting({ action: "disable", guildId: interaction.guildId, actorUserId: interaction.user.id });
      await interaction.editReply("Counting XP is off. Existing counting progress is unchanged.");
      return;
    }

    if (subcommand === "reset-all") {
      if (!interaction.options.getBoolean("confirm", true)) throw new PublicError("Nothing was reset. Choose `confirm: True` only when you want to erase all counting progress.");
      const result = await api.resetCounting({ guildId: interaction.guildId, actorUserId: interaction.user.id });
      await interaction.editReply(`Reset **${result.resetProfiles.toLocaleString()} counting profiles** and removed **${result.resetEntries.toLocaleString()} accepted-count records**. Regular XP was not touched.`);
      return;
    }

    const config = await api.getGuildConfig(interaction.guildId);
    if (subcommand === "status") {
      await interaction.editReply({ embeds: [settingsEmbed(config.settings?.settings.counting)], allowedMentions: { parse: [] } });
      return;
    }

    if (subcommand === "leaderboard") {
      const result = await api.getCountingLeaderboard(interaction.guildId);
      if (!result.leaderboard.length) {
        await interaction.editReply("No accepted counts have earned counting XP yet.");
        return;
      }
      const medals = ["🥇", "🥈", "🥉"];
      const lines = result.leaderboard.map((profile) => `${medals[profile.rank - 1] ?? `**${profile.rank}.**`} <@${profile.userId}> · **Level ${profile.level}** · ${profile.xp.toLocaleString()} XP · ${profile.acceptedCounts.toLocaleString()} counts`);
      await interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x55b686).setTitle("🔢 Counting leaderboard").setDescription(lines.join("\n")).setFooter({ text: "Separate from the regular XP leaderboard" })], allowedMentions: { parse: [] } });
      return;
    }

    const user = interaction.options.getUser("member") ?? interaction.user;
    const result = await api.getCountingProfile(interaction.guildId, user.id);
    const progress = levelProgress(result.profile.xp, countingLevelCurve(config.settings?.settings.counting));
    const filled = Math.round(progress.percent / 10);
    await interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x55b686).setAuthor({ name: user.globalName ?? user.username, iconURL: user.displayAvatarURL() }).setTitle(`Counting level ${progress.level}`).setDescription(`${"◆".repeat(filled)}${"◇".repeat(10 - filled)}  **${progress.percent}%**\n${progress.current.toLocaleString()} / ${progress.required.toLocaleString()} counting XP until level ${progress.level + 1}`).addFields(
      { name: "Counting standing", value: `#${result.profile.rank}`, inline: true },
      { name: "Counting XP", value: result.profile.xp.toLocaleString(), inline: true },
      { name: "Accepted counts", value: result.profile.acceptedCounts.toLocaleString(), inline: true },
      { name: "Highest number", value: result.profile.highestNumber ? result.profile.highestNumber.toLocaleString() : "None yet", inline: true },
    ).setFooter({ text: "Regular server XP is tracked separately" })], allowedMentions: { parse: [] } });
  },
};

export const countingCommands: OnyxCommand[] = [counting];
