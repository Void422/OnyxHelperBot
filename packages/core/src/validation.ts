import { z } from "zod";
import { guildModules } from "./domain";

const snowflake = z.string().regex(/^\d{17,20}$/, "Choose a valid Discord resource.");

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
    })
    .default({}),
});

export const appealSubmissionSchema = z.object({
  caseId: z.string().uuid(),
  statement: z.string().min(40, "Please give the staff team a little more detail.").max(4_000),
  context: z.string().max(2_000).optional(),
  acknowledged: z.literal(true),
});
