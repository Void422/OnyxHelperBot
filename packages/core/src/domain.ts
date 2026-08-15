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

export const availableGuildModules = guildModules.filter((module) => module !== "role_menus");

export type GuildModule = (typeof guildModules)[number];

export interface WarningThreshold {
  count: number;
  action: "timeout" | "kick" | "ban";
  durationMs?: number;
}

export interface MessageTemplate {
  content?: string;
  title?: string;
  description?: string;
  color?: string;
  footer?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
}

export interface TicketSettings {
  categoryId?: string;
  logChannelId?: string;
  staffRoleIds?: string[];
  panelTitle?: string;
  panelDescription?: string;
  buttonLabel?: string;
  channelNamePattern?: string;
  maxOpenPerUser?: number;
  allowUserClose?: boolean;
}

export interface WelcomeSettings {
  channelId?: string;
  goodbyeChannelId?: string;
  directMessage?: boolean;
}

export interface AutoroleSettings {
  memberRoleIds?: string[];
  botRoleIds?: string[];
  delaySeconds?: number;
  minimumAccountAgeDays?: number;
}

export interface SuggestionSettings {
  channelId?: string;
  anonymous?: boolean;
  createThreads?: boolean;
}

export interface StarboardSettings {
  channelId?: string;
  emoji?: string;
  threshold?: number;
  allowSelfStars?: boolean;
  ignoredChannelIds?: string[];
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
  welcome?: WelcomeSettings;
  autoroles?: AutoroleSettings;
  tickets?: TicketSettings;
  suggestions?: SuggestionSettings;
  starboard?: StarboardSettings;
  messages?: {
    welcome?: MessageTemplate;
    goodbye?: MessageTemplate;
    levelUp?: MessageTemplate;
    warningDm?: MessageTemplate;
    ticketOpen?: MessageTemplate;
    giveawayWinner?: MessageTemplate;
  };
  commandOverrides?: Record<string, { enabled?: boolean; cooldownSeconds?: number }>;
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
