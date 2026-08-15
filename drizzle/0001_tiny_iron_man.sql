CREATE TABLE `starboard_entries` (
	`source_message_id` text PRIMARY KEY NOT NULL,
	`guild_id` text NOT NULL,
	`source_channel_id` text NOT NULL,
	`starboard_message_id` text,
	`star_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`guild_id`) REFERENCES `guilds`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `starboard_entries_guild_idx` ON `starboard_entries` (`guild_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `guilds` ADD `next_ticket_number` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `guilds` ADD `next_suggestion_number` integer DEFAULT 1 NOT NULL;