CREATE TABLE `appeal_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`appeal_id` text NOT NULL,
	`author_user_id` text NOT NULL,
	`author_kind` text NOT NULL,
	`message` text NOT NULL,
	`internal` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`appeal_id`) REFERENCES `appeals`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `appeal_messages_appeal_idx` ON `appeal_messages` (`appeal_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `appeals` (
	`id` text PRIMARY KEY NOT NULL,
	`guild_id` text NOT NULL,
	`case_id` text NOT NULL,
	`appellant_user_id` text NOT NULL,
	`statement` text NOT NULL,
	`context` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`reviewer_user_id` text,
	`internal_notes` text,
	`decision_reason` text,
	`decided_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`guild_id`) REFERENCES `guilds`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`case_id`) REFERENCES `moderation_cases`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `appeals_guild_status_idx` ON `appeals` (`guild_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `appeals_case_user_open_unique` ON `appeals` (`case_id`,`appellant_user_id`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`guild_id` text NOT NULL,
	`actor_user_id` text NOT NULL,
	`source` text NOT NULL,
	`action` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text,
	`before` text,
	`after` text,
	`metadata` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`guild_id`) REFERENCES `guilds`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `audit_logs_guild_created_idx` ON `audit_logs` (`guild_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `audit_logs_guild_action_idx` ON `audit_logs` (`guild_id`,`action`);--> statement-breakpoint
CREATE TABLE `automod_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`guild_id` text NOT NULL,
	`kind` text NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`conditions` text DEFAULT '{}' NOT NULL,
	`actions` text DEFAULT '["notify"]' NOT NULL,
	`exempt_role_ids` text DEFAULT '[]' NOT NULL,
	`exempt_channel_ids` text DEFAULT '[]' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`guild_id`) REFERENCES `guilds`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `automod_rules_guild_kind_unique` ON `automod_rules` (`guild_id`,`kind`);--> statement-breakpoint
CREATE INDEX `automod_rules_guild_idx` ON `automod_rules` (`guild_id`);--> statement-breakpoint
CREATE TABLE `giveaway_entries` (
	`giveaway_id` text NOT NULL,
	`user_id` text NOT NULL,
	`weight` integer DEFAULT 1 NOT NULL,
	`eligible` integer DEFAULT true NOT NULL,
	`ineligible_reason` text,
	`entered_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`giveaway_id`, `user_id`),
	FOREIGN KEY (`giveaway_id`) REFERENCES `giveaways`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `giveaway_entries_eligible_idx` ON `giveaway_entries` (`giveaway_id`,`eligible`);--> statement-breakpoint
CREATE TABLE `giveaways` (
	`id` text PRIMARY KEY NOT NULL,
	`guild_id` text NOT NULL,
	`channel_id` text NOT NULL,
	`message_id` text,
	`host_user_id` text NOT NULL,
	`prize` text NOT NULL,
	`description` text,
	`winner_count` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`ends_at` integer NOT NULL,
	`paused_at` integer,
	`requirements` text DEFAULT '{}' NOT NULL,
	`winner_user_ids` text DEFAULT '[]' NOT NULL,
	`eligible_entry_count` integer,
	`reroll_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`guild_id`) REFERENCES `guilds`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `giveaways_guild_status_idx` ON `giveaways` (`guild_id`,`status`);--> statement-breakpoint
CREATE INDEX `giveaways_due_idx` ON `giveaways` (`status`,`ends_at`);--> statement-breakpoint
CREATE TABLE `guild_settings` (
	`guild_id` text PRIMARY KEY NOT NULL,
	`enabled_modules` text DEFAULT '["moderation","logging"]' NOT NULL,
	`staff_role_ids` text DEFAULT '[]' NOT NULL,
	`locale` text DEFAULT 'en-US' NOT NULL,
	`timezone` text DEFAULT 'UTC' NOT NULL,
	`settings` text DEFAULT '{}' NOT NULL,
	`onboarding_completed` integer DEFAULT false NOT NULL,
	`updated_by` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`guild_id`) REFERENCES `guilds`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `guilds` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`icon_hash` text,
	`member_count` integer DEFAULT 0 NOT NULL,
	`bot_installed` integer DEFAULT true NOT NULL,
	`next_case_number` integer DEFAULT 1 NOT NULL,
	`joined_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `level_profiles` (
	`guild_id` text NOT NULL,
	`user_id` text NOT NULL,
	`xp` integer DEFAULT 0 NOT NULL,
	`message_count` integer DEFAULT 0 NOT NULL,
	`last_xp_at` integer,
	`weekly_xp` integer DEFAULT 0 NOT NULL,
	`monthly_xp` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`guild_id`, `user_id`),
	FOREIGN KEY (`guild_id`) REFERENCES `guilds`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `level_profiles_guild_xp_idx` ON `level_profiles` (`guild_id`,`xp`);--> statement-breakpoint
CREATE TABLE `level_roles` (
	`id` text PRIMARY KEY NOT NULL,
	`guild_id` text NOT NULL,
	`level` integer NOT NULL,
	`role_id` text NOT NULL,
	`stack` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`guild_id`) REFERENCES `guilds`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `level_roles_guild_level_unique` ON `level_roles` (`guild_id`,`level`);--> statement-breakpoint
CREATE TABLE `log_configurations` (
	`guild_id` text PRIMARY KEY NOT NULL,
	`channels` text DEFAULT '{}' NOT NULL,
	`include_moderator` integer DEFAULT true NOT NULL,
	`retention_days` integer DEFAULT 180 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`guild_id`) REFERENCES `guilds`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `moderation_cases` (
	`id` text PRIMARY KEY NOT NULL,
	`guild_id` text NOT NULL,
	`case_number` integer NOT NULL,
	`target_user_id` text NOT NULL,
	`moderator_user_id` text NOT NULL,
	`action` text NOT NULL,
	`reason` text NOT NULL,
	`duration_ms` integer,
	`expires_at` integer,
	`evidence` text DEFAULT '[]' NOT NULL,
	`automated` integer DEFAULT false NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`related_channel_id` text,
	`related_message_id` text,
	`appeal_status` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`guild_id`) REFERENCES `guilds`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `moderation_cases_guild_number_unique` ON `moderation_cases` (`guild_id`,`case_number`);--> statement-breakpoint
CREATE INDEX `moderation_cases_guild_target_idx` ON `moderation_cases` (`guild_id`,`target_user_id`);--> statement-breakpoint
CREATE INDEX `moderation_cases_guild_action_idx` ON `moderation_cases` (`guild_id`,`action`);--> statement-breakpoint
CREATE INDEX `moderation_cases_guild_created_idx` ON `moderation_cases` (`guild_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `moderator_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`guild_id` text NOT NULL,
	`user_id` text NOT NULL,
	`moderator_user_id` text NOT NULL,
	`note` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`guild_id`) REFERENCES `guilds`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `moderator_notes_guild_user_idx` ON `moderator_notes` (`guild_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `oauth_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`csrf_token` text NOT NULL,
	`encrypted_access_token` text NOT NULL,
	`encrypted_refresh_token` text NOT NULL,
	`token_expires_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `oauth_sessions_user_idx` ON `oauth_sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `oauth_sessions_expiry_idx` ON `oauth_sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`window_ends_at` integer NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reminders` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`guild_id` text,
	`channel_id` text,
	`message` text NOT NULL,
	`due_at` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`lease_until` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `reminders_due_idx` ON `reminders` (`status`,`due_at`);--> statement-breakpoint
CREATE INDEX `reminders_user_idx` ON `reminders` (`user_id`,`status`);--> statement-breakpoint
CREATE TABLE `session_guilds` (
	`session_id` text NOT NULL,
	`guild_id` text NOT NULL,
	`name` text NOT NULL,
	`icon_hash` text,
	`permissions` text NOT NULL,
	`owner` integer DEFAULT false NOT NULL,
	`fetched_at` integer NOT NULL,
	PRIMARY KEY(`session_id`, `guild_id`),
	FOREIGN KEY (`session_id`) REFERENCES `oauth_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `session_guilds_guild_idx` ON `session_guilds` (`guild_id`);--> statement-breakpoint
CREATE TABLE `suggestions` (
	`id` text PRIMARY KEY NOT NULL,
	`guild_id` text NOT NULL,
	`suggestion_number` integer NOT NULL,
	`author_user_id` text NOT NULL,
	`content` text NOT NULL,
	`message_id` text,
	`status` text DEFAULT 'open' NOT NULL,
	`staff_response` text,
	`anonymous` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`guild_id`) REFERENCES `guilds`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `suggestions_guild_number_unique` ON `suggestions` (`guild_id`,`suggestion_number`);--> statement-breakpoint
CREATE INDEX `suggestions_guild_status_idx` ON `suggestions` (`guild_id`,`status`);--> statement-breakpoint
CREATE TABLE `temporary_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`guild_id` text NOT NULL,
	`user_id` text NOT NULL,
	`action` text NOT NULL,
	`payload` text DEFAULT '{}' NOT NULL,
	`due_at` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`lease_until` integer,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`completed_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`guild_id`) REFERENCES `guilds`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `temporary_actions_due_idx` ON `temporary_actions` (`status`,`due_at`);--> statement-breakpoint
CREATE TABLE `ticket_participants` (
	`ticket_id` text NOT NULL,
	`user_id` text NOT NULL,
	`added_by` text NOT NULL,
	`added_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`ticket_id`, `user_id`),
	FOREIGN KEY (`ticket_id`) REFERENCES `tickets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tickets` (
	`id` text PRIMARY KEY NOT NULL,
	`guild_id` text NOT NULL,
	`ticket_number` integer NOT NULL,
	`channel_id` text NOT NULL,
	`owner_user_id` text NOT NULL,
	`department` text DEFAULT 'general' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`claimed_by` text,
	`close_reason` text,
	`closed_at` integer,
	`transcript_key` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`guild_id`) REFERENCES `guilds`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tickets_guild_number_unique` ON `tickets` (`guild_id`,`ticket_number`);--> statement-breakpoint
CREATE INDEX `tickets_guild_status_idx` ON `tickets` (`guild_id`,`status`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`display_name` text,
	`avatar_hash` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `warnings` (
	`id` text PRIMARY KEY NOT NULL,
	`guild_id` text NOT NULL,
	`case_id` text,
	`user_id` text NOT NULL,
	`moderator_user_id` text NOT NULL,
	`reason` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`expires_at` integer,
	`removed_at` integer,
	`removed_by` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`guild_id`) REFERENCES `guilds`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`case_id`) REFERENCES `moderation_cases`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `warnings_guild_user_active_idx` ON `warnings` (`guild_id`,`user_id`,`active`);