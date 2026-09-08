CREATE TABLE `counting_entries` (
	`message_id` text PRIMARY KEY NOT NULL,
	`guild_id` text NOT NULL,
	`channel_id` text NOT NULL,
	`user_id` text NOT NULL,
	`count_number` integer NOT NULL,
	`xp_award` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`guild_id`) REFERENCES `guilds`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `counting_entries_guild_idx` ON `counting_entries` (`guild_id`);--> statement-breakpoint
CREATE INDEX `counting_entries_guild_user_idx` ON `counting_entries` (`guild_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `counting_profiles` (
	`guild_id` text NOT NULL,
	`user_id` text NOT NULL,
	`xp` integer DEFAULT 0 NOT NULL,
	`accepted_counts` integer DEFAULT 0 NOT NULL,
	`highest_number` integer DEFAULT 0 NOT NULL,
	`last_count_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`guild_id`, `user_id`),
	FOREIGN KEY (`guild_id`) REFERENCES `guilds`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `counting_profiles_guild_xp_idx` ON `counting_profiles` (`guild_id`,`xp`);--> statement-breakpoint
PRAGMA optimize;
