import type { Guild } from "discord.js";
import type { GuildSettingsData, GuildModule, GiveawayRequirements } from "@/packages/core/src/domain";
import type { LevelCurve } from "@/packages/core/src/rank-ladders";
import { config } from "./config";
import { PublicError } from "./errors";

export interface BotGuildConfig {
  settings: {
    guildId: string;
    enabledModules: GuildModule[];
    staffRoleIds: string[];
    settings: GuildSettingsData;
    version: number;
  } | null;
  logs: { channels: Record<string, string>; includeModerator: boolean; retentionDays: number } | null;
  automodRules: Array<{
    id: string;
    kind: string;
    enabled: boolean;
    conditions: Record<string, unknown>;
    actions: string[];
    exemptRoleIds: string[];
    exemptChannelIds: string[];
  }>;
  levelRoles: Array<{ level: number; roleId: string; stack: boolean }>;
  channelMessageLimits?: Array<{ id: string; guildId: string; channelId: string; maxMessages: number; enabled: boolean }>;
}

interface CacheEntry {
  expiresAt: number;
  value: BotGuildConfig;
}

export class OnyxApiClient {
  private readonly configCache = new Map<string, CacheEntry>();

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("authorization", `Bearer ${config.ONYX_SERVICE_TOKEN}`);
    headers.set("accept", "application/json");
    if (init.body) headers.set("content-type", "application/json");
    let response: Response;
    try {
      response = await fetch(`${config.ONYX_API_URL}${path}`, { ...init, headers, signal: AbortSignal.timeout(12_000) });
    } catch {
      throw new PublicError("Onyx could not reach its data service. Nothing was changed, so try again in a moment.");
    }
    const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
    if (!response.ok) throw new PublicError(body?.error?.message ?? "Onyx could not finish that request.");
    return body as T;
  }

  async registerGuild(guild: Guild) {
    return this.request<{ ok: true }>("/api/internal/guilds/register", {
      method: "POST",
      body: JSON.stringify({ id: guild.id, name: guild.name, iconHash: guild.icon, memberCount: guild.memberCount, joinedAt: guild.joinedAt ?? new Date() }),
    });
  }

  async getGuildConfig(guildId: string, force = false) {
    const cached = this.configCache.get(guildId);
    if (!force && cached && cached.expiresAt > Date.now()) return cached.value;
    const value = await this.request<BotGuildConfig>(`/api/internal/guilds/${guildId}/config`);
    this.configCache.set(guildId, { value, expiresAt: Date.now() + 30_000 });
    return value;
  }

  createCase(input: {
    guildId: string;
    targetUserId: string;
    moderatorUserId: string;
    action: string;
    reason: string;
    durationMs?: number;
    expiresAt?: Date;
    automated?: boolean;
    relatedChannelId?: string;
    relatedMessageId?: string;
  }) {
    return this.request<{ case: { id: string; caseNumber: number } }>("/api/internal/cases", { method: "POST", body: JSON.stringify(input) });
  }

  getCases(guildId: string, userId?: string) {
    const query = new URLSearchParams({ guildId });
    if (userId) query.set("userId", userId);
    return this.request<{ cases: ModerationCaseRecord[] }>(`/api/internal/cases?${query}`);
  }

  getCase(guildId: string, caseNumber: number) {
    const query = new URLSearchParams({ guildId, caseNumber: String(caseNumber) });
    return this.request<{ case: ModerationCaseRecord }>(`/api/internal/cases?${query}`);
  }

  updateCaseReason(input: { guildId: string; caseNumber: number; moderatorUserId: string; reason: string }) {
    return this.request<{ case: ModerationCaseRecord }>("/api/internal/cases", { method: "PATCH", body: JSON.stringify(input) });
  }

  warn(input: { guildId: string; userId: string; moderatorUserId: string; reason: string; expiresAt?: Date }) {
    return this.request<{ warning: { id: string; caseNumber: number }; activeCount: number }>("/api/internal/warnings", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  getWarnings(guildId: string, userId: string) {
    const query = new URLSearchParams({ guildId, userId });
    return this.request<{ warnings: Array<{ id: string; caseNumber: number | null; reason: string; moderatorUserId: string; createdAt: string }> }>(`/api/internal/warnings?${query}`);
  }

  removeWarning(input: { guildId: string; userId: string; moderatorUserId: string; warningId?: string; clearAll?: boolean }) {
    return this.request<{ removedCount: number }>("/api/internal/warnings", { method: "DELETE", body: JSON.stringify(input) });
  }

  getModeratorNotes(guildId: string, userId: string) {
    const query = new URLSearchParams({ guildId, userId });
    return this.request<{ notes: ModeratorNoteRecord[] }>(`/api/internal/notes?${query}`);
  }

  addModeratorNote(input: { guildId: string; userId: string; moderatorUserId: string; note: string }) {
    return this.request<{ note: ModeratorNoteRecord }>("/api/internal/notes", { method: "POST", body: JSON.stringify(input) });
  }

  removeModeratorNote(input: { guildId: string; noteId: string; moderatorUserId: string }) {
    return this.request<{ removed: true }>("/api/internal/notes", { method: "DELETE", body: JSON.stringify(input) });
  }

  awardXp(input: { guildId: string; userId: string; award: number; occurredAt: Date }) {
    return this.request<{ profile: { xp: number; messageCount: number }; level: number }>("/api/internal/xp/award", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  claimChannelMessage(input: { guildId: string; channelId: string; userId: string; seedCount?: number }) {
    return this.request<
      | { active: false; allowed: true; messageCount: number; maximum: null }
      | { active: true; needsSeed: true; maximum: number }
      | { active: true; allowed: boolean; messageCount: number; maximum: number }
    >("/api/internal/message-limits/claim", { method: "POST", body: JSON.stringify(input) });
  }

  async setChannelMessageLimit(input: { guildId: string; channelId: string; actorUserId: string; maxMessages: number }) {
    const result = await this.request<{ limit: NonNullable<BotGuildConfig["channelMessageLimits"]>[number] }>("/api/internal/message-limits/config", {
      method: "PUT",
      body: JSON.stringify(input),
    });
    this.configCache.delete(input.guildId);
    return result;
  }

  async removeChannelMessageLimit(input: { guildId: string; channelId: string; actorUserId: string }) {
    const result = await this.request<{ removed: true }>("/api/internal/message-limits/config", {
      method: "DELETE",
      body: JSON.stringify(input),
    });
    this.configCache.delete(input.guildId);
    return result;
  }

  getLevelProfile(guildId: string, userId: string) {
    const query = new URLSearchParams({ guildId, userId });
    return this.request<{ profile: { xp: number; messageCount: number; rank: number }; level: number }>(`/api/internal/xp/profile?${query}`);
  }

  adjustXp(input: { guildId: string; userId: string; moderatorUserId: string; operation: "add" | "remove" | "set"; amount: number; reason: string }) {
    return this.request<{ profile: { xp: number; messageCount: number }; level: number }>("/api/internal/xp/profile", { method: "PATCH", body: JSON.stringify(input) });
  }

  getLeaderboard(guildId: string) {
    return this.request<{ leaderboard: Array<{ userId: string; xp: number; messageCount: number; weeklyXp: number; rank: number; level: number }> }>(`/api/internal/xp/leaderboard?${new URLSearchParams({ guildId })}`);
  }

  configureLevelRoles(input: { guildId: string; actorUserId: string; curve: LevelCurve; rewards: Array<{ level: number; roleId: string; stack: boolean }> }) {
    return this.request<{ rewards: BotGuildConfig["levelRoles"]; curve: LevelCurve }>("/api/internal/level-roles", { method: "PUT", body: JSON.stringify(input) });
  }

  createGiveaway(input: {
    guildId: string;
    channelId: string;
    hostUserId: string;
    prize: string;
    description?: string;
    winnerCount: number;
    endsAt: Date;
    requirements?: GiveawayRequirements;
  }) {
    return this.request<{ giveaway: { id: string } }>("/api/internal/giveaways", { method: "POST", body: JSON.stringify(input) });
  }

  listGiveaways(guildId: string) {
    return this.request<{ giveaways: GiveawayRecord[] }>(`/api/internal/giveaways/manage?${new URLSearchParams({ guildId })}`);
  }

  getGiveaway(guildId: string, giveawayId: string) {
    return this.request<{ giveaway: GiveawayRecord; entryCount: number }>(`/api/internal/giveaways/manage?${new URLSearchParams({ guildId, giveawayId })}`);
  }

  manageGiveaway(input: { guildId: string; giveawayId: string; actorUserId: string; action: "end" | "reroll" | "pause" | "resume" | "edit"; prize?: string; description?: string | null; winnerCount?: number; endsAt?: Date }) {
    return this.request<{ giveaway: GiveawayRecord }>("/api/internal/giveaways/manage", { method: "PATCH", body: JSON.stringify(input) });
  }

  setGiveawayMessage(giveawayId: string, messageId: string) {
    return this.request<{ ok: true }>(`/api/internal/giveaways/${giveawayId}/message`, { method: "PATCH", body: JSON.stringify({ messageId }) });
  }

  enterGiveaway(giveawayId: string, input: { userId: string; roleIds: string[]; accountCreatedAt: Date; joinedAt: Date }) {
    return this.request<{ entered: true; entries: number; totalEntries: number; prize: string; endsAt: string; requirements: GiveawayRequirements }>(`/api/internal/giveaways/${giveawayId}/enter`, { method: "POST", body: JSON.stringify(input) });
  }

  scheduleAutoroles(input: { guildId: string; userId: string; roleIds: string[]; dueAt: Date }) {
    return this.request<{ ok: true }>("/api/internal/jobs/autoroles", { method: "POST", body: JSON.stringify(input) });
  }

  scheduleWinnerRoleRemoval(input: { guildId: string; userId: string; roleId: string; dueAt: Date }) {
    return this.request<{ ok: true }>("/api/internal/jobs/role-rewards", { method: "POST", body: JSON.stringify(input) });
  }

  createTicket(input: { guildId: string; channelId: string; ownerUserId: string; department?: string }) {
    return this.request<{ ticket: TicketRecord }>("/api/internal/tickets", { method: "POST", body: JSON.stringify(input) });
  }

  getTicket(guildId: string, channelId: string) {
    return this.request<{ ticket: TicketRecord; participants: Array<{ userId: string }> }>(`/api/internal/tickets?${new URLSearchParams({ guildId, channelId })}`);
  }

  getOpenTickets(guildId: string, ownerUserId: string) {
    return this.request<{ tickets: TicketRecord[] }>(`/api/internal/tickets?${new URLSearchParams({ guildId, ownerUserId })}`);
  }

  updateTicket(input: { guildId: string; channelId: string; actorUserId: string; action: "claim" | "close" | "reopen" | "participant_add" | "participant_remove"; userId?: string; reason?: string }) {
    return this.request<{ ticket: TicketRecord }>("/api/internal/tickets", { method: "PATCH", body: JSON.stringify(input) });
  }

  createReminder(input: { userId: string; guildId?: string; channelId?: string; message: string; dueAt: Date }) {
    return this.request<{ reminder: ReminderRecord }>("/api/internal/reminders", { method: "POST", body: JSON.stringify(input) });
  }

  getReminders(userId: string) {
    return this.request<{ reminders: ReminderRecord[] }>(`/api/internal/reminders?${new URLSearchParams({ userId })}`);
  }

  deleteReminder(userId: string, reminderId: string) {
    return this.request<{ removed: true }>("/api/internal/reminders", { method: "DELETE", body: JSON.stringify({ userId, reminderId }) });
  }

  claimDueReminders() {
    return this.request<{ reminders: ReminderRecord[] }>("/api/internal/reminders/due", { method: "POST" });
  }

  completeReminder(reminderId: string, success: boolean) {
    return this.request<{ ok: true }>("/api/internal/reminders/due", { method: "PATCH", body: JSON.stringify({ reminderId, success }) });
  }

  createSuggestion(input: { guildId: string; authorUserId: string; content: string; anonymous: boolean }) {
    return this.request<{ suggestion: SuggestionRecord }>("/api/internal/suggestions", { method: "POST", body: JSON.stringify(input) });
  }

  listSuggestions(guildId: string) {
    return this.request<{ suggestions: SuggestionRecord[] }>(`/api/internal/suggestions?${new URLSearchParams({ guildId })}`);
  }

  updateSuggestion(input: { guildId: string; suggestionNumber: number; actorUserId: string; action: "message" | "approved" | "denied" | "implemented" | "duplicate"; messageId?: string; response?: string }) {
    return this.request<{ suggestion: SuggestionRecord }>("/api/internal/suggestions", { method: "PATCH", body: JSON.stringify(input) });
  }

  claimStarboard(input: { guildId: string; sourceMessageId: string; sourceChannelId: string; starCount: number }) {
    return this.request<{ created: boolean; entry: StarboardEntry }>("/api/internal/starboard", { method: "POST", body: JSON.stringify(input) });
  }

  updateStarboard(input: { guildId: string; sourceMessageId: string; sourceChannelId: string; starCount: number; starboardMessageId: string }) {
    return this.request<{ entry: StarboardEntry }>("/api/internal/starboard", { method: "PATCH", body: JSON.stringify(input) });
  }

  claimDueTemporaryJobs() {
    return this.request<{ jobs: TemporaryJob[] }>("/api/internal/jobs/temporary/due", { method: "POST" });
  }

  completeTemporaryJob(jobId: string, success: boolean, error?: string) {
    return this.request<{ ok: true }>(`/api/internal/jobs/temporary/${jobId}/complete`, {
      method: "POST",
      body: JSON.stringify({ success, error }),
    });
  }

  endDueGiveaways() {
    return this.request<{ giveaways: EndedGiveaway[] }>("/api/internal/giveaways/due", { method: "POST" });
  }
}

export interface TemporaryJob {
  id: string;
  guild_id: string;
  user_id: string;
  action: "unban" | "untimeout" | "remove_role" | "unlock_channel" | "add_roles";
  payload: string | Record<string, string>;
}

export interface ModerationCaseRecord {
  id: string;
  caseNumber: number;
  targetUserId: string;
  moderatorUserId: string;
  action: string;
  reason: string;
  durationMs: number | null;
  expiresAt: string | null;
  active: boolean;
  automated: boolean;
  createdAt: string;
}

export interface ModeratorNoteRecord {
  id: string;
  userId: string;
  moderatorUserId: string;
  note: string;
  createdAt: string;
}

export interface EndedGiveaway {
  id: string;
  guildId: string;
  channelId: string;
  messageId: string | null;
  prize: string;
  winnerUserIds: string[];
  eligibleEntryCount: number;
  requirements: GiveawayRequirements;
}

export interface GiveawayRecord {
  id: string;
  guildId: string;
  channelId: string;
  messageId: string | null;
  hostUserId: string;
  prize: string;
  description: string | null;
  winnerCount: number;
  status: "scheduled" | "active" | "paused" | "ending" | "ended" | "cancelled";
  endsAt: string;
  winnerUserIds: string[];
  eligibleEntryCount: number | null;
  rerollCount: number;
  requirements: GiveawayRequirements;
}

export interface TicketRecord {
  id: string;
  guildId: string;
  ticketNumber: number;
  channelId: string;
  ownerUserId: string;
  department: string;
  status: "open" | "claimed" | "closed";
  claimedBy: string | null;
  closeReason: string | null;
  closedAt: string | null;
  createdAt: string;
}

export interface ReminderRecord {
  id: string;
  userId: string;
  guildId: string | null;
  channelId: string | null;
  message: string;
  dueAt: string;
  status: "pending" | "processing" | "sent" | "cancelled" | "failed";
}

export interface SuggestionRecord {
  id: string;
  guildId: string;
  suggestionNumber: number;
  authorUserId: string;
  content: string;
  messageId: string | null;
  status: "open" | "approved" | "denied" | "implemented" | "duplicate";
  staffResponse: string | null;
  anonymous: boolean;
  createdAt: string;
}

export interface StarboardEntry {
  sourceMessageId: string;
  guildId: string;
  sourceChannelId: string;
  starboardMessageId: string | null;
  starCount: number;
}
