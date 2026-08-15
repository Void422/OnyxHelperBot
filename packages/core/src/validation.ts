import { z } from "zod";
import { guildModules } from "./domain";

const snowflake = z.string().regex(/^\d{17,20}$/, "Choose a valid Discord resource.");
const optionalHttpsUrl = z.string().url().refine((value) => new URL(value).protocol === "https:", "Use a secure HTTPS URL.").optional();
const messageTemplateSchema = z
  .object({
    content: z.string().max(2_000).optional(),
    title: z.string().max(256).optional(),
    description: z.string().max(4_096).optional(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a six-digit hex color.").optional(),
    footer: z.string().max(2_048).optional(),
    imageUrl: optionalHttpsUrl,
    thumbnailUrl: optionalHttpsUrl,
  })
  .refine((value) => Boolean(value.content || value.title || value.description), "Add message content or an embed title/description.");

export const settingsUpdateSchema = z.object({
  enabledModules: z.array(z.enum(guildModules)).max(guildModules.length),
  staffRoleIds: z.array(snowflake).max(25),
  locale: z.string().min(2).max(12),
  timezone: z.string().min(1).max(64),
  settings: z.object({
    moderationLogChannelId: snowflake.optional(),
    staffAlertChannelId: snowflake.optional(),
    ticketCategoryId: snowflake.optional(),
    ticketStaffRoleIds: z.array(snowflake).max(20).optional(),
    levelAnnouncementChannelId: snowflake.optional(),
    welcomeChannelId: snowflake.optional(),
    welcomeMessage: z.string().max(2_000).optional(),
    welcome: z
      .object({
        channelId: snowflake.optional(),
        goodbyeChannelId: snowflake.optional(),
        directMessage: z.boolean().optional(),
      })
      .optional(),
    autoroles: z
      .object({
        memberRoleIds: z.array(snowflake).max(20).optional(),
        botRoleIds: z.array(snowflake).max(20).optional(),
        delaySeconds: z.number().int().min(0).max(86_400).optional(),
        minimumAccountAgeDays: z.number().int().min(0).max(3_650).optional(),
      })
      .optional(),
    tickets: z
      .object({
        categoryId: snowflake.optional(),
        logChannelId: snowflake.optional(),
        staffRoleIds: z.array(snowflake).max(20).optional(),
        panelTitle: z.string().min(1).max(256).optional(),
        panelDescription: z.string().max(4_096).optional(),
        buttonLabel: z.string().min(1).max(80).optional(),
        channelNamePattern: z.string().min(1).max(80).regex(/^[a-z0-9-{_}]+$/, "Use lowercase letters, numbers, dashes, and placeholders.").optional(),
        maxOpenPerUser: z.number().int().min(1).max(10).optional(),
        allowUserClose: z.boolean().optional(),
      })
      .optional(),
    suggestions: z
      .object({
        channelId: snowflake.optional(),
        anonymous: z.boolean().optional(),
        createThreads: z.boolean().optional(),
      })
      .optional(),
    starboard: z
      .object({
        channelId: snowflake.optional(),
        emoji: z.string().min(1).max(32).optional(),
        threshold: z.number().int().min(2).max(100).optional(),
        allowSelfStars: z.boolean().optional(),
        ignoredChannelIds: z.array(snowflake).max(100).optional(),
      })
      .optional(),
    giveaways: z
      .object({
        requiredRoleId: snowflake.optional(),
        blockedRoleId: snowflake.optional(),
        minimumLevel: z.number().int().min(0).max(1_000).optional(),
        minimumAccountAgeDays: z.number().int().min(0).max(3_650).optional(),
        minimumMembershipAgeDays: z.number().int().min(0).max(3_650).optional(),
        bonusRoleId: snowflake.optional(),
        bonusEntries: z.number().int().min(1).max(20).optional(),
        winnerRoleId: snowflake.optional(),
        winnerRoleDurationHours: z.number().int().min(0).max(8_760).optional(),
        accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a six-digit hex color.").optional(),
        entryButtonLabel: z.string().min(1).max(80).optional(),
      })
      .optional(),
    messages: z
      .object({
        welcome: messageTemplateSchema.optional(),
        goodbye: messageTemplateSchema.optional(),
        levelUp: messageTemplateSchema.optional(),
        warningDm: messageTemplateSchema.optional(),
        ticketOpen: messageTemplateSchema.optional(),
        giveawayWinner: messageTemplateSchema.optional(),
      })
      .optional(),
    commandOverrides: z
      .record(
        z.string().regex(/^[a-z0-9_-]+(?:\.[a-z0-9_-]+)?$/).max(64),
        z.object({ enabled: z.boolean().optional(), cooldownSeconds: z.number().int().min(0).max(3_600).optional() }),
      )
      .refine((value) => Object.keys(value).length <= 100, "No more than 100 command overrides can be stored.")
      .optional(),
    warningThresholds: z
      .array(
        z.object({
          count: z.number().int().min(1).max(100),
          action: z.enum(["timeout", "kick", "ban"]),
          durationMs: z.number().int().positive().max(28 * 86_400_000).optional(),
        }),
      )
      .max(10)
      .optional(),
    xp: z
      .object({
        curve: z.enum(["standard", "grind", "legendary"]).optional(),
        cooldownSeconds: z.number().int().min(15).max(600).optional(),
        minimumMessageLength: z.number().int().min(3).max(200).optional(),
        minAward: z.number().int().min(1).max(100).optional(),
        maxAward: z.number().int().min(1).max(200).optional(),
        excludedChannelIds: z.array(snowflake).max(100).optional(),
        excludedRoleIds: z.array(snowflake).max(100).optional(),
      })
      .refine((value) => !value.minAward || !value.maxAward || value.minAward <= value.maxAward, "Minimum XP cannot exceed maximum XP.")
      .optional(),
    presence: z
      .object({
        status: z.enum(["online", "idle", "dnd"]).optional(),
        activityType: z.enum(["Playing", "Watching", "Listening", "Competing"]).optional(),
        messages: z.array(z.string().min(1).max(128)).max(10).optional(),
      })
      .optional(),
  }),
});

export const internalCaseSchema = z.object({
  guildId: snowflake,
  targetUserId: snowflake,
  moderatorUserId: snowflake,
  action: z.string().min(2).max(40),
  reason: z.string().min(1).max(1_000),
  durationMs: z.number().int().positive().max(365 * 86_400_000).optional(),
  expiresAt: z.coerce.date().optional(),
  evidence: z.array(z.string().url()).max(10).default([]),
  automated: z.boolean().default(false),
  relatedChannelId: snowflake.optional(),
  relatedMessageId: snowflake.optional(),
});

export const giveawayCreateSchema = z.object({
  guildId: snowflake,
  channelId: snowflake,
  hostUserId: snowflake,
  prize: z.string().min(1).max(256),
  description: z.string().max(2_000).optional(),
  winnerCount: z.number().int().min(1).max(20),
  endsAt: z.coerce.date().refine((date) => date.getTime() > Date.now() + 10_000, "End time must be in the future."),
  requirements: z
    .object({
      requiredRoleIds: z.array(snowflake).max(20).optional(),
      blockedRoleIds: z.array(snowflake).max(20).optional(),
      excludedUserIds: z.array(snowflake).max(100).optional(),
      minimumAccountAgeDays: z.number().int().min(0).max(3_650).optional(),
      minimumMembershipAgeDays: z.number().int().min(0).max(3_650).optional(),
      minimumLevel: z.number().int().min(0).max(1_000).optional(),
      minimumXp: z.number().int().min(0).max(2_000_000_000).optional(),
      roleBonusEntries: z.record(snowflake, z.number().int().min(1).max(20)).optional(),
      winnerRoleId: snowflake.optional(),
      winnerRoleDurationMs: z.number().int().min(0).max(365 * 86_400_000).optional(),
      accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      entryButtonLabel: z.string().min(1).max(80).optional(),
    })
    .default({}),
});

export const appealSubmissionSchema = z.object({
  caseId: z.string().uuid(),
  statement: z.string().min(40, "Please give the staff team a little more detail.").max(4_000),
  context: z.string().max(2_000).optional(),
  acknowledged: z.literal(true),
});
