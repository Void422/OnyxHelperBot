import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname } from "node:path";
import type { DatabaseSync as NodeDatabase } from "node:sqlite";
import { countingAwardForNumber, countingLevelCurve, defaultCountingSettings, resolveCountingSettings } from "@/packages/core/src/counting";
import type { CountingSettings } from "@/packages/core/src/domain";
import { levelFromXp } from "@/packages/core/src/leveling";

const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as typeof import("node:sqlite");

export interface LocalCountingProfile {
  xp: number;
  acceptedCounts: number;
  highestNumber: number;
  lastCountAt: string | null;
  rank: number;
}

export type CountingConfigurationInput =
  | { action: "setup"; guildId: string; actorUserId: string; channelId: string; validatorBotId: string; acceptedEmoji: string }
  | { action: "rewards"; guildId: string; actorUserId: string; baseAward: number; bonusEvery: number; bonusAward: number; maximumAward: number }
  | { action: "curve"; guildId: string; actorUserId: string; levelBaseXp: number; levelGrowthXp: number; levelGrowthPercent: number }
  | { action: "disable"; guildId: string; actorUserId: string };

interface StoredProfile {
  xp: number;
  accepted_counts: number;
  highest_number: number;
  last_count_at: number | null;
}

export class CountingStore {
  private readonly database: NodeDatabase;

  constructor(filePath: string) {
    mkdirSync(dirname(filePath), { recursive: true });
    this.database = new DatabaseSync(filePath);
    this.database.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = FULL;
      CREATE TABLE IF NOT EXISTS counting_settings (
        guild_id TEXT PRIMARY KEY NOT NULL,
        settings_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS counting_profiles (
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        xp INTEGER NOT NULL DEFAULT 0,
        accepted_counts INTEGER NOT NULL DEFAULT 0,
        highest_number INTEGER NOT NULL DEFAULT 0,
        last_count_at INTEGER,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (guild_id, user_id)
      );
      CREATE INDEX IF NOT EXISTS counting_profiles_guild_xp_idx ON counting_profiles (guild_id, xp DESC, accepted_counts DESC);
      CREATE TABLE IF NOT EXISTS counting_entries (
        message_id TEXT PRIMARY KEY NOT NULL,
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        count_number INTEGER NOT NULL,
        xp_award INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS counting_entries_guild_idx ON counting_entries (guild_id);
    `);
  }

  close() {
    this.database.close();
  }

  getSettings(guildId: string): CountingSettings | undefined {
    const row = this.database.prepare("SELECT settings_json FROM counting_settings WHERE guild_id = ?").get(guildId) as { settings_json: string } | undefined;
    if (!row) return undefined;
    const settings = JSON.parse(row.settings_json) as CountingSettings;
    return resolveCountingSettings(settings);
  }

  configure(input: CountingConfigurationInput) {
    const before = this.getSettings(input.guildId) ?? defaultCountingSettings;
    let counting: CountingSettings;
    switch (input.action) {
      case "setup":
        counting = { ...before, enabled: true, channelId: input.channelId, validatorBotId: input.validatorBotId, acceptedEmoji: input.acceptedEmoji };
        break;
      case "rewards":
        counting = { ...before, baseAward: input.baseAward, bonusEvery: input.bonusEvery, bonusAward: input.bonusAward, maximumAward: input.maximumAward };
        break;
      case "curve":
        counting = { ...before, levelBaseXp: input.levelBaseXp, levelGrowthXp: input.levelGrowthXp, levelGrowthPercent: input.levelGrowthPercent };
        break;
      case "disable":
        counting = { ...before, enabled: false };
        break;
    }
    this.database.prepare(`
      INSERT INTO counting_settings (guild_id, settings_json, updated_at) VALUES (?, ?, ?)
      ON CONFLICT (guild_id) DO UPDATE SET settings_json = excluded.settings_json, updated_at = excluded.updated_at
    `).run(input.guildId, JSON.stringify(counting), Date.now());
    return { counting };
  }

  award(input: { guildId: string; channelId: string; userId: string; messageId: string; countNumber: number; occurredAt: Date }) {
    const counting = this.getSettings(input.guildId);
    if (!counting?.enabled || !counting.channelId) throw new Error("Counting XP is not enabled for this server.");
    if (counting.channelId !== input.channelId) throw new Error("That count came from the wrong channel.");
    const xpAward = countingAwardForNumber(input.countNumber, counting);
    const occurredAt = input.occurredAt.getTime();
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const inserted = this.database.prepare(`
        INSERT INTO counting_entries (message_id, guild_id, channel_id, user_id, count_number, xp_award, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT (message_id) DO NOTHING
      `).run(input.messageId, input.guildId, input.channelId, input.userId, input.countNumber, xpAward, occurredAt);
      if (inserted.changes) {
        this.database.prepare(`
          INSERT INTO counting_profiles (guild_id, user_id, xp, accepted_counts, highest_number, last_count_at, updated_at)
          VALUES (?, ?, ?, 1, ?, ?, ?)
          ON CONFLICT (guild_id, user_id) DO UPDATE SET
            xp = min(2000000000, counting_profiles.xp + excluded.xp),
            accepted_counts = counting_profiles.accepted_counts + 1,
            highest_number = max(counting_profiles.highest_number, excluded.highest_number),
            last_count_at = excluded.last_count_at,
            updated_at = excluded.updated_at
        `).run(input.guildId, input.userId, xpAward, input.countNumber, occurredAt, Date.now());
      }
      this.database.exec("COMMIT");
      const profile = this.profile(input.guildId, input.userId);
      const profileWithoutRank = {
        xp: profile.xp,
        acceptedCounts: profile.acceptedCounts,
        highestNumber: profile.highestNumber,
        lastCountAt: profile.lastCountAt,
      };
      return { awarded: Boolean(inserted.changes), xpAward: inserted.changes ? xpAward : 0, profile: profileWithoutRank, level: levelFromXp(profile.xp, countingLevelCurve(counting)) };
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  profile(guildId: string, userId: string): LocalCountingProfile {
    const row = this.database.prepare(`
      SELECT xp, accepted_counts, highest_number, last_count_at
      FROM counting_profiles WHERE guild_id = ? AND user_id = ?
    `).get(guildId, userId) as unknown as StoredProfile | undefined;
    const xp = row?.xp ?? 0;
    const higher = this.database.prepare("SELECT count(*) AS total FROM counting_profiles WHERE guild_id = ? AND xp > ?").get(guildId, xp) as { total: number };
    return {
      xp,
      acceptedCounts: row?.accepted_counts ?? 0,
      highestNumber: row?.highest_number ?? 0,
      lastCountAt: row?.last_count_at ? new Date(row.last_count_at).toISOString() : null,
      rank: higher.total + 1,
    };
  }

  getProfile(guildId: string, userId: string) {
    const profile = this.profile(guildId, userId);
    return { profile, level: levelFromXp(profile.xp, countingLevelCurve(this.getSettings(guildId))) };
  }

  leaderboard(guildId: string) {
    const settings = this.getSettings(guildId);
    const rows = this.database.prepare(`
      SELECT user_id, xp, accepted_counts, highest_number, last_count_at
      FROM counting_profiles WHERE guild_id = ?
      ORDER BY xp DESC, accepted_counts DESC, user_id ASC LIMIT 10
    `).all(guildId) as unknown as Array<StoredProfile & { user_id: string }>;
    return rows.map((row, index) => ({
      userId: row.user_id,
      xp: row.xp,
      acceptedCounts: row.accepted_counts,
      highestNumber: row.highest_number,
      lastCountAt: row.last_count_at ? new Date(row.last_count_at).toISOString() : null,
      rank: index + 1,
      level: levelFromXp(row.xp, countingLevelCurve(settings)),
    }));
  }

  reset(guildId: string) {
    const profiles = this.database.prepare("SELECT count(*) AS total FROM counting_profiles WHERE guild_id = ?").get(guildId) as { total: number };
    const entries = this.database.prepare("SELECT count(*) AS total FROM counting_entries WHERE guild_id = ?").get(guildId) as { total: number };
    this.database.exec("BEGIN IMMEDIATE");
    try {
      this.database.prepare("DELETE FROM counting_entries WHERE guild_id = ?").run(guildId);
      this.database.prepare("DELETE FROM counting_profiles WHERE guild_id = ?").run(guildId);
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
    return { resetProfiles: profiles.total, resetEntries: entries.total };
  }
}
