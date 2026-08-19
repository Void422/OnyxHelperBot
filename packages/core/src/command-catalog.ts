import type { GuildModule } from "./domain";

export interface CommandCatalogEntry {
  key: string;
  command: string;
  description: string;
  category: "Moderation" | "Administration" | "Giveaways" | "Levels" | "Tickets" | "Community" | "Utilities" | "Information";
  permission: string;
  module?: GuildModule;
  defaultCooldownSeconds?: number;
}

const entries = (
  category: CommandCatalogEntry["category"],
  permission: string,
  module: GuildModule | undefined,
  values: Array<[string, string, number?]>,
): CommandCatalogEntry[] => values.map(([key, description, defaultCooldownSeconds]) => ({
  key,
  command: `/${key.replace(".", " ")}`,
  description,
  category,
  permission,
  module,
  defaultCooldownSeconds,
}));

export const commandCatalogEntries: CommandCatalogEntry[] = [
  ...entries("Moderation", "Ban Members", "moderation", [
    ["ban", "Ban a member permanently or for a specific duration.", 3],
    ["unban", "Lift an active Discord ban by user ID."],
    ["softban", "Clear recent messages while allowing the member to rejoin.", 5],
  ]),
  ...entries("Moderation", "Kick Members", "moderation", [["kick", "Remove a member without preventing a future return.", 3]]),
  ...entries("Moderation", "Moderate Members", "moderation", [
    ["timeout", "Apply a Discord communication timeout.", 3],
    ["untimeout", "Remove an active communication timeout."],
    ["mute", "Apply a timed server-wide communication mute.", 3],
    ["unmute", "Remove an Onyx communication mute.", 3],
    ["warn", "Create a persistent warning and evaluate escalation rules.", 2],
    ["warnings", "Review a member's active warnings."],
    ["delwarn", "Remove one warning using its case number."],
    ["clearwarns", "Clear every active warning for one member."],
    ["history", "Review a member's recent moderation cases."],
    ["case", "Open one moderation case by number."],
    ["reason", "Correct the reason attached to a case."],
    ["modnote", "Add a private staff note to a member."],
    ["notes", "Review private staff notes."],
    ["removenote", "Remove a private staff note."],
  ]),
  ...entries("Moderation", "Manage Messages", "moderation", [["purge", "Delete a filtered batch of recent messages.", 5]]),
  ...entries("Moderation", "Manage Channels", "moderation", [
    ["lock", "Pause member messages in the current channel."],
    ["unlock", "Restore member messages in the current channel."],
    ["slowmode", "Set or clear the current channel's slowmode."],
  ]),
  ...entries("Moderation", "Manage Nicknames", "moderation", [
    ["nick", "Change a member's server nickname."],
    ["resetnick", "Restore a member's Discord username."],
  ]),
  ...entries("Administration", "Manage Roles", "moderation", [
    ["role.add", "Give a manageable role to a member.", 2],
    ["role.remove", "Remove a manageable role from a member.", 2],
    ["role.members", "List members who currently have a role.", 2],
  ]),
  ...entries("Administration", "Manage Server", undefined, [["announce", "Post a styled announcement with an optional image.", 5]]),
  ...entries("Administration", "Administrator", undefined, [
    ["message-limit.set", "Set or change a channel's per-person lifetime message limit.", 2],
    ["message-limit.remove", "Remove a channel's message limit and clear its saved counts.", 2],
    ["message-limit.list", "List every active channel message limit.", 2],
  ]),
  ...entries("Administration", "Manage Messages", undefined, [["say", "Post a plain message through Onyx with mentions disabled.", 3]]),
  ...entries("Administration", "Manage Channels", undefined, [["topic", "Update or clear a text channel topic."], ["thread", "Start a public discussion thread."]]),
  ...entries("Giveaways", "Manage Server", "giveaways", [
    ["giveaway.create", "Launch a role-gated drop with boosted tickets and winner rewards.", 3],
    ["giveaway.list", "List recent giveaways and their IDs.", 3],
    ["giveaway.info", "Inspect entrants, state, and timing for a giveaway.", 3],
    ["giveaway.end", "End a running giveaway and draw winners now.", 3],
    ["giveaway.reroll", "Select replacement winners from eligible entries.", 3],
    ["giveaway.pause", "Pause entries without losing remaining time.", 3],
    ["giveaway.resume", "Resume a paused giveaway.", 3],
    ["giveaway.edit", "Update the prize, details, timing, or winner count.", 3],
  ]),
  ...entries("Levels", "Everyone", "levels", [["rank", "View XP progress, rank title, and the next unlock.", 3], ["leaderboard", "View the ten highest-ranked members.", 10], ["levelroles.list", "Review every rank and role unlock."]]),
  ...entries("Levels", "Manage Roles", "levels", [["levelroles.setup", "Create a complete colored rank ladder with unlockable perks."]]),
  ...entries("Levels", "Manage Server", "levels", [
    ["xp.get", "Review a member's exact XP profile.", 2],
    ["xp.add", "Add XP with an auditable reason.", 2],
    ["xp.remove", "Remove XP without going below zero.", 2],
    ["xp.set", "Set an exact XP value with an audit record.", 2],
  ]),
  ...entries("Tickets", "Manage Channels", "tickets", [
    ["ticket.panel", "Post a configured ticket-opening panel.", 2],
    ["ticket.info", "Inspect the current ticket's owner and state.", 2],
    ["ticket.claim", "Assign the current ticket to yourself.", 2],
    ["ticket.close", "Close the current ticket with a reason.", 2],
    ["ticket.reopen", "Reopen a previously closed ticket.", 2],
    ["ticket.add", "Give another member access to the ticket.", 2],
    ["ticket.remove", "Remove a participant from the ticket.", 2],
    ["ticket.rename", "Rename the ticket channel.", 2],
    ["ticket.transcript", "Export the latest 100 messages as a text file.", 2],
  ]),
  ...entries("Community", "Everyone", "suggestions", [["suggest", "Post an idea to the configured suggestion board.", 30]]),
  ...entries("Community", "Manage Server", "suggestions", [
    ["suggestion.list", "Review recent suggestions and their statuses."],
    ["suggestion.approve", "Approve a suggestion with an optional response."],
    ["suggestion.deny", "Deny a suggestion with an optional response."],
    ["suggestion.implement", "Mark a suggestion as implemented."],
    ["suggestion.duplicate", "Mark a suggestion as a duplicate."],
  ]),
  ...entries("Utilities", "Everyone", undefined, [
    ["remind.create", "Create a persistent channel or direct-message reminder.", 2],
    ["remind.list", "Review active reminders.", 2],
    ["remind.delete", "Cancel an active reminder.", 2],
    ["ping", "Check Discord and interaction response latency.", 3],
    ["uptime", "See when the current bot process started."],
    ["avatar", "Open a member's avatar at full resolution."],
    ["banner", "Open a member's profile banner."],
    ["help", "Browse the live command catalog by category."],
  ]),
  ...entries("Information", "Everyone", undefined, [
    ["userinfo", "View account and membership details."],
    ["serverinfo", "View a concise server summary."],
    ["roleinfo", "Inspect role position, members, and permissions."],
    ["channelinfo", "Inspect a channel's type, topic, and age."],
    ["membercount", "View the current server member total."],
    ["emojis", "Browse custom server emoji."],
    ["stickers", "List custom server stickers."],
    ["botinfo", "View the live Onyx process summary."],
  ]),
];
