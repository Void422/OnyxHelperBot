export const guildModules = [
  "moderation",
  "logging",
  "automod",
  "appeals",
  "giveaways",
  "levels",
  "tickets",
  "welcome",
  "autoroles",
  "role_menus",
  "suggestions",
  "starboard",
] as const;

export type GuildModule = (typeof guildModules)[number];

export interface WarningThreshold {
  count: number;
  action: "timeout" | "kick" | "ban";
  durationMs?: number;
}

export interface GuildSettingsData {
  commandPrefix?: string;
  moderationLogChannelId?: string;
  staffAlertChannelId?: string;
  ticketCategoryId?: string;
  ticketStaffRoleIds?: string[];
  levelAnnouncementChannelId?: string;
  welcomeChannelId?: string;
  welcomeMessage?: string;
  warningThresholds?: WarningThreshold[];
  xp?: {
    cooldownSeconds?: number;
    minimumMessageLength?: number;
    minAward?: number;
    maxAward?: number;
    excludedChannelIds?: string[];
    excludedRoleIds?: string[];
  };
  presence?: {
    status?: "online" | "idle" | "dnd";
    activityType?: "Playing" | "Watching" | "Listening" | "Competing";
    messages?: string[];
  };
}

export interface GiveawayRequirements {
  requiredRoleIds?: string[];
  blockedRoleIds?: string[];
  excludedUserIds?: string[];
  minimumAccountAgeDays?: number;
  minimumMembershipAgeDays?: number;
  minimumLevel?: number;
  minimumXp?: number;
  roleBonusEntries?: Record<string, number>;
}

export interface AutomodConditions {
  threshold?: number;
  intervalSeconds?: number;
  minimumAccountAgeDays?: number;
  percentage?: number;
  values?: string[];
  timeoutSeconds?: number;
}

export type LogCategory =
  | "moderation"
  | "messages"
  | "members"
  | "server"
  | "voice"
  | "automod"
  | "giveaways"
  | "appeals"
  | "tickets"
  | "dashboard";

export type LogChannelMap = Partial<Record<LogCategory, string>>;

export interface DiscordGuildSummary {
  id: string;
  name: string;
  icon: string | null;
  permissions: string;
  owner: boolean;
  botInstalled: boolean;
  canManage: boolean;
}
