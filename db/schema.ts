import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import type {
  AutomodConditions,
  GuildModule,
  GuildSettingsData,
  GiveawayRequirements,
  LogChannelMap,
} from "@/packages/core/src/domain";

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
};

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull(),
  displayName: text("display_name"),
  avatarHash: text("avatar_hash"),
  ...timestamps,
});

export const oauthSessions = sqliteTable(
  "oauth_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    csrfToken: text("csrf_token").notNull(),
    encryptedAccessToken: text("encrypted_access_token").notNull(),
    encryptedRefreshToken: text("encrypted_refresh_token").notNull(),
    tokenExpiresAt: integer("token_expires_at", { mode: "timestamp_ms" }).notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    lastSeenAt: integer("last_seen_at", { mode: "timestamp_ms" }).notNull(),
    ...timestamps,
  },
  (table) => [index("oauth_sessions_user_idx").on(table.userId), index("oauth_sessions_expiry_idx").on(table.expiresAt)],
);

export const sessionGuilds = sqliteTable(
  "session_guilds",
  {
    sessionId: text("session_id")
      .notNull()
      .references(() => oauthSessions.id, { onDelete: "cascade" }),
    guildId: text("guild_id").notNull(),
    name: text("name").notNull(),
    iconHash: text("icon_hash"),
    permissions: text("permissions").notNull(),
    owner: integer("owner", { mode: "boolean" }).notNull().default(false),
    fetchedAt: integer("fetched_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.sessionId, table.guildId] }), index("session_guilds_guild_idx").on(table.guildId)],
);

export const guilds = sqliteTable("guilds", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  iconHash: text("icon_hash"),
  memberCount: integer("member_count").notNull().default(0),
  botInstalled: integer("bot_installed", { mode: "boolean" }).notNull().default(true),
  nextCaseNumber: integer("next_case_number").notNull().default(1),
  nextTicketNumber: integer("next_ticket_number").notNull().default(1),
  nextSuggestionNumber: integer("next_suggestion_number").notNull().default(1),
  joinedAt: integer("joined_at", { mode: "timestamp_ms" }).notNull(),
  ...timestamps,
});

export const guildSettings = sqliteTable("guild_settings", {
  guildId: text("guild_id")
    .primaryKey()
    .references(() => guilds.id, { onDelete: "cascade" }),
  enabledModules: text("enabled_modules", { mode: "json" })
    .$type<GuildModule[]>()
    .notNull()
    .default(sql`'["moderation","logging"]'`),
  staffRoleIds: text("staff_role_ids", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
  locale: text("locale").notNull().default("en-US"),
  timezone: text("timezone").notNull().default("UTC"),
  settings: text("settings", { mode: "json" }).$type<GuildSettingsData>().notNull().default(sql`'{}'`),
  onboardingCompleted: integer("onboarding_completed", { mode: "boolean" }).notNull().default(false),
  updatedBy: text("updated_by"),
  version: integer("version").notNull().default(1),
  ...timestamps,
});

export const logConfigurations = sqliteTable("log_configurations", {
  guildId: text("guild_id")
    .primaryKey()
    .references(() => guilds.id, { onDelete: "cascade" }),
  channels: text("channels", { mode: "json" }).$type<LogChannelMap>().notNull().default(sql`'{}'`),
  includeModerator: integer("include_moderator", { mode: "boolean" }).notNull().default(true),
  retentionDays: integer("retention_days").notNull().default(180),
  ...timestamps,
});

export const automodRules = sqliteTable(
  "automod_rules",
  {
    id: text("id").primaryKey(),
    guildId: text("guild_id")
      .notNull()
      .references(() => guilds.id, { onDelete: "cascade" }),
    kind: text("kind", {
      enum: ["spam", "mentions", "invites", "links", "caps", "duplicate", "blocked_words", "blocked_domains", "new_account"],
    }).notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
    conditions: text("conditions", { mode: "json" }).$type<AutomodConditions>().notNull().default(sql`'{}'`),
    actions: text("actions", { mode: "json" }).$type<string[]>().notNull().default(sql`'["notify"]'`),
    exemptRoleIds: text("exempt_role_ids", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
    exemptChannelIds: text("exempt_channel_ids", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
    ...timestamps,
  },
  (table) => [uniqueIndex("automod_rules_guild_kind_unique").on(table.guildId, table.kind), index("automod_rules_guild_idx").on(table.guildId)],
);

export const moderationCases = sqliteTable(
  "moderation_cases",
  {
    id: text("id").primaryKey(),
    guildId: text("guild_id")
      .notNull()
      .references(() => guilds.id, { onDelete: "cascade" }),
    caseNumber: integer("case_number").notNull(),
    targetUserId: text("target_user_id").notNull(),
    moderatorUserId: text("moderator_user_id").notNull(),
    action: text("action").notNull(),
    reason: text("reason").notNull(),
    durationMs: integer("duration_ms"),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
    evidence: text("evidence", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
    automated: integer("automated", { mode: "boolean" }).notNull().default(false),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    relatedChannelId: text("related_channel_id"),
    relatedMessageId: text("related_message_id"),
    appealStatus: text("appeal_status"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("moderation_cases_guild_number_unique").on(table.guildId, table.caseNumber),
    index("moderation_cases_guild_target_idx").on(table.guildId, table.targetUserId),
    index("moderation_cases_guild_action_idx").on(table.guildId, table.action),
    index("moderation_cases_guild_created_idx").on(table.guildId, table.createdAt),
  ],
);

export const warnings = sqliteTable(
  "warnings",
  {
    id: text("id").primaryKey(),
    guildId: text("guild_id")
      .notNull()
      .references(() => guilds.id, { onDelete: "cascade" }),
    caseId: text("case_id").references(() => moderationCases.id, { onDelete: "set null" }),
    userId: text("user_id").notNull(),
    moderatorUserId: text("moderator_user_id").notNull(),
    reason: text("reason").notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
    removedAt: integer("removed_at", { mode: "timestamp_ms" }),
    removedBy: text("removed_by"),
    ...timestamps,
  },
  (table) => [index("warnings_guild_user_active_idx").on(table.guildId, table.userId, table.active)],
);

export const moderatorNotes = sqliteTable(
  "moderator_notes",
  {
    id: text("id").primaryKey(),
    guildId: text("guild_id").notNull().references(() => guilds.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    moderatorUserId: text("moderator_user_id").notNull(),
    note: text("note").notNull(),
    ...timestamps,
  },
  (table) => [index("moderator_notes_guild_user_idx").on(table.guildId, table.userId)],
);

export const temporaryActions = sqliteTable(
  "temporary_actions",
  {
    id: text("id").primaryKey(),
    guildId: text("guild_id").notNull().references(() => guilds.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    action: text("action", { enum: ["unban", "untimeout", "remove_role", "unlock_channel", "add_roles"] }).notNull(),
    payload: text("payload", { mode: "json" }).$type<Record<string, string>>().notNull().default(sql`'{}'`),
    dueAt: integer("due_at", { mode: "timestamp_ms" }).notNull(),
    status: text("status", { enum: ["pending", "processing", "completed", "failed", "cancelled"] }).notNull().default("pending"),
    leaseUntil: integer("lease_until", { mode: "timestamp_ms" }),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (table) => [index("temporary_actions_due_idx").on(table.status, table.dueAt)],
);

export const appeals = sqliteTable(
  "appeals",
  {
    id: text("id").primaryKey(),
    guildId: text("guild_id").notNull().references(() => guilds.id, { onDelete: "cascade" }),
    caseId: text("case_id").notNull().references(() => moderationCases.id, { onDelete: "restrict" }),
    appellantUserId: text("appellant_user_id").notNull(),
    statement: text("statement").notNull(),
    context: text("context"),
    status: text("status", { enum: ["pending", "reviewing", "accepted", "denied", "closed", "more_information"] }).notNull().default("pending"),
    reviewerUserId: text("reviewer_user_id"),
    internalNotes: text("internal_notes"),
    decisionReason: text("decision_reason"),
    decidedAt: integer("decided_at", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (table) => [index("appeals_guild_status_idx").on(table.guildId, table.status), uniqueIndex("appeals_case_user_open_unique").on(table.caseId, table.appellantUserId)],
);

export const appealMessages = sqliteTable(
  "appeal_messages",
  {
    id: text("id").primaryKey(),
    appealId: text("appeal_id").notNull().references(() => appeals.id, { onDelete: "cascade" }),
    authorUserId: text("author_user_id").notNull(),
    authorKind: text("author_kind", { enum: ["appellant", "staff"] }).notNull(),
    message: text("message").notNull(),
    internal: integer("internal", { mode: "boolean" }).notNull().default(false),
    ...timestamps,
  },
  (table) => [index("appeal_messages_appeal_idx").on(table.appealId, table.createdAt)],
);

export const giveaways = sqliteTable(
  "giveaways",
  {
    id: text("id").primaryKey(),
    guildId: text("guild_id").notNull().references(() => guilds.id, { onDelete: "cascade" }),
    channelId: text("channel_id").notNull(),
    messageId: text("message_id"),
    hostUserId: text("host_user_id").notNull(),
    prize: text("prize").notNull(),
    description: text("description"),
    winnerCount: integer("winner_count").notNull().default(1),
    status: text("status", { enum: ["scheduled", "active", "paused", "ending", "ended", "cancelled"] }).notNull().default("active"),
    endsAt: integer("ends_at", { mode: "timestamp_ms" }).notNull(),
    pausedAt: integer("paused_at", { mode: "timestamp_ms" }),
    requirements: text("requirements", { mode: "json" }).$type<GiveawayRequirements>().notNull().default(sql`'{}'`),
    winnerUserIds: text("winner_user_ids", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
    eligibleEntryCount: integer("eligible_entry_count"),
    rerollCount: integer("reroll_count").notNull().default(0),
    ...timestamps,
  },
  (table) => [index("giveaways_guild_status_idx").on(table.guildId, table.status), index("giveaways_due_idx").on(table.status, table.endsAt)],
);

export const giveawayEntries = sqliteTable(
  "giveaway_entries",
  {
    giveawayId: text("giveaway_id").notNull().references(() => giveaways.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    weight: integer("weight").notNull().default(1),
    eligible: integer("eligible", { mode: "boolean" }).notNull().default(true),
    ineligibleReason: text("ineligible_reason"),
    enteredAt: integer("entered_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
  },
  (table) => [primaryKey({ columns: [table.giveawayId, table.userId] }), index("giveaway_entries_eligible_idx").on(table.giveawayId, table.eligible)],
);

export const levelProfiles = sqliteTable(
  "level_profiles",
  {
    guildId: text("guild_id").notNull().references(() => guilds.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    xp: integer("xp").notNull().default(0),
    messageCount: integer("message_count").notNull().default(0),
    lastXpAt: integer("last_xp_at", { mode: "timestamp_ms" }),
    weeklyXp: integer("weekly_xp").notNull().default(0),
    monthlyXp: integer("monthly_xp").notNull().default(0),
    ...timestamps,
  },
  (table) => [primaryKey({ columns: [table.guildId, table.userId] }), index("level_profiles_guild_xp_idx").on(table.guildId, table.xp)],
);

export const levelRoles = sqliteTable(
  "level_roles",
  {
    id: text("id").primaryKey(),
    guildId: text("guild_id").notNull().references(() => guilds.id, { onDelete: "cascade" }),
    level: integer("level").notNull(),
    roleId: text("role_id").notNull(),
    stack: integer("stack", { mode: "boolean" }).notNull().default(true),
    ...timestamps,
  },
  (table) => [uniqueIndex("level_roles_guild_level_unique").on(table.guildId, table.level)],
);

export const tickets = sqliteTable(
  "tickets",
  {
    id: text("id").primaryKey(),
    guildId: text("guild_id").notNull().references(() => guilds.id, { onDelete: "cascade" }),
    ticketNumber: integer("ticket_number").notNull(),
    channelId: text("channel_id").notNull(),
    ownerUserId: text("owner_user_id").notNull(),
    department: text("department").notNull().default("general"),
    status: text("status", { enum: ["open", "claimed", "closed"] }).notNull().default("open"),
    claimedBy: text("claimed_by"),
    closeReason: text("close_reason"),
    closedAt: integer("closed_at", { mode: "timestamp_ms" }),
    transcriptKey: text("transcript_key"),
    ...timestamps,
  },
  (table) => [uniqueIndex("tickets_guild_number_unique").on(table.guildId, table.ticketNumber), index("tickets_guild_status_idx").on(table.guildId, table.status)],
);

export const ticketParticipants = sqliteTable(
  "ticket_participants",
  {
    ticketId: text("ticket_id").notNull().references(() => tickets.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    addedBy: text("added_by").notNull(),
    addedAt: integer("added_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
  },
  (table) => [primaryKey({ columns: [table.ticketId, table.userId] })],
);

export const reminders = sqliteTable(
  "reminders",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    guildId: text("guild_id"),
    channelId: text("channel_id"),
    message: text("message").notNull(),
    dueAt: integer("due_at", { mode: "timestamp_ms" }).notNull(),
    status: text("status", { enum: ["pending", "processing", "sent", "cancelled", "failed"] }).notNull().default("pending"),
    leaseUntil: integer("lease_until", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (table) => [index("reminders_due_idx").on(table.status, table.dueAt), index("reminders_user_idx").on(table.userId, table.status)],
);

export const suggestions = sqliteTable(
  "suggestions",
  {
    id: text("id").primaryKey(),
    guildId: text("guild_id").notNull().references(() => guilds.id, { onDelete: "cascade" }),
    suggestionNumber: integer("suggestion_number").notNull(),
    authorUserId: text("author_user_id").notNull(),
    content: text("content").notNull(),
    messageId: text("message_id"),
    status: text("status", { enum: ["open", "approved", "denied", "implemented", "duplicate"] }).notNull().default("open"),
    staffResponse: text("staff_response"),
    anonymous: integer("anonymous", { mode: "boolean" }).notNull().default(false),
    ...timestamps,
  },
  (table) => [uniqueIndex("suggestions_guild_number_unique").on(table.guildId, table.suggestionNumber), index("suggestions_guild_status_idx").on(table.guildId, table.status)],
);

export const starboardEntries = sqliteTable(
  "starboard_entries",
  {
    sourceMessageId: text("source_message_id").primaryKey(),
    guildId: text("guild_id").notNull().references(() => guilds.id, { onDelete: "cascade" }),
    sourceChannelId: text("source_channel_id").notNull(),
    starboardMessageId: text("starboard_message_id"),
    starCount: integer("star_count").notNull().default(0),
    ...timestamps,
  },
  (table) => [index("starboard_entries_guild_idx").on(table.guildId, table.createdAt)],
);

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    guildId: text("guild_id").notNull().references(() => guilds.id, { onDelete: "cascade" }),
    actorUserId: text("actor_user_id").notNull(),
    source: text("source", { enum: ["dashboard", "bot", "system"] }).notNull(),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id"),
    before: text("before", { mode: "json" }).$type<Record<string, unknown> | null>(),
    after: text("after", { mode: "json" }).$type<Record<string, unknown> | null>(),
    metadata: text("metadata", { mode: "json" }).$type<Record<string, unknown>>().notNull().default(sql`'{}'`),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
  },
  (table) => [index("audit_logs_guild_created_idx").on(table.guildId, table.createdAt), index("audit_logs_guild_action_idx").on(table.guildId, table.action)],
);

export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  windowEndsAt: integer("window_ends_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
});
