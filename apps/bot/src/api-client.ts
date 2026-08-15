import type { Guild } from "discord.js";
import type { GuildSettingsData, GuildModule, GiveawayRequirements } from "@/packages/core/src/domain";
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
  logs: { channels: Record<string, string> } | null;
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

  warn(input: { guildId: string; userId: string; moderatorUserId: string; reason: string; expiresAt?: Date }) {
    return this.request<{ warning: { id: string; caseNumber: number }; activeCount: number }>("/api/internal/warnings", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  getWarnings(guildId: string, userId: string) {
    const query = new URLSearchParams({ guildId, userId });
    return this.request<{ warnings: Array<{ id: string; reason: string; moderatorUserId: string; createdAt: string }> }>(`/api/internal/warnings?${query}`);
  }

  awardXp(input: { guildId: string; userId: string; award: number; occurredAt: Date }) {
    return this.request<{ profile: { xp: number; messageCount: number }; level: number }>("/api/internal/xp/award", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  getLevelProfile(guildId: string, userId: string) {
    const query = new URLSearchParams({ guildId, userId });
    return this.request<{ profile: { xp: number; messageCount: number; rank: number }; level: number }>(`/api/internal/xp/profile?${query}`);
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

  setGiveawayMessage(giveawayId: string, messageId: string) {
    return this.request<{ ok: true }>(`/api/internal/giveaways/${giveawayId}/message`, { method: "PATCH", body: JSON.stringify({ messageId }) });
  }

  enterGiveaway(giveawayId: string, input: { userId: string; roleIds: string[]; accountCreatedAt: Date; joinedAt: Date }) {
    return this.request<{ entered: true; entries: number }>(`/api/internal/giveaways/${giveawayId}/enter`, { method: "POST", body: JSON.stringify(input) });
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
  action: "unban" | "untimeout" | "remove_role" | "unlock_channel";
  payload: string | Record<string, string>;
}

export interface EndedGiveaway {
  id: string;
  guildId: string;
  channelId: string;
  messageId: string | null;
  prize: string;
  winnerUserIds: string[];
  eligibleEntryCount: number;
}
