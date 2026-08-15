export interface XpMessage {
  guildId: string;
  channelId: string;
  userId: string;
  content: string;
  roleIds: string[];
  createdAt: number;
  isBot?: boolean;
}

export interface XpPolicyConfig {
  cooldownMs: number;
  minimumLength: number;
  excludedChannelIds: string[];
  excludedRoleIds: string[];
  minAward: number;
  maxAward: number;
}

export interface XpDecision {
  award: number;
  reason?: "bot" | "excluded" | "too_short" | "cooldown" | "duplicate" | "low_signal";
  fingerprint: string;
}

interface UserState {
  lastAwardAt: number;
  recentFingerprints: string[];
  recentEmojiRatio: number;
}

function normalize(content: string) {
  return content
    .toLocaleLowerCase()
    .replace(/https?:\/\/\S+/g, "<url>")
    .replace(/<a?:\w+:\d+>/g, "<emoji>")
    .replace(/\s+/g, " ")
    .trim();
}

function hashFingerprint(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function emojiRatio(value: string) {
  const symbols = value.match(/\p{Extended_Pictographic}/gu)?.length ?? 0;
  return symbols / Math.max(1, [...value].length);
}

export class XpPolicy {
  private readonly users = new Map<string, UserState>();

  evaluate(message: XpMessage, config: XpPolicyConfig): XpDecision {
    const normalized = normalize(message.content);
    const fingerprint = hashFingerprint(normalized);
    if (message.isBot) return { award: 0, reason: "bot", fingerprint };
    if (config.excludedChannelIds.includes(message.channelId) || message.roleIds.some((role) => config.excludedRoleIds.includes(role))) {
      return { award: 0, reason: "excluded", fingerprint };
    }
    if (normalized.length < config.minimumLength) return { award: 0, reason: "too_short", fingerprint };

    const key = `${message.guildId}:${message.userId}`;
    const state = this.users.get(key) ?? { lastAwardAt: 0, recentFingerprints: [], recentEmojiRatio: 0 };
    if (message.createdAt - state.lastAwardAt < config.cooldownMs) return { award: 0, reason: "cooldown", fingerprint };
    if (state.recentFingerprints.includes(fingerprint)) return { award: 0, reason: "duplicate", fingerprint };

    const ratio = emojiRatio(message.content);
    if (ratio > 0.55 || /^(.)\1{5,}$/u.test(normalized.replace(/\s/g, ""))) {
      state.recentEmojiRatio = ratio;
      this.users.set(key, state);
      return { award: 0, reason: "low_signal", fingerprint };
    }

    const span = Math.max(0, config.maxAward - config.minAward);
    const deterministicVariation = span === 0 ? 0 : Number.parseInt(fingerprint.slice(-4), 36) % (span + 1);
    const richness = Math.min(1, new Set(normalized.split(" ")).size / 10);
    const award = Math.max(config.minAward, Math.round((config.minAward + deterministicVariation) * (0.75 + richness * 0.25)));

    state.lastAwardAt = message.createdAt;
    state.recentFingerprints = [fingerprint, ...state.recentFingerprints].slice(0, 6);
    state.recentEmojiRatio = ratio;
    this.users.set(key, state);
    return { award, fingerprint };
  }
}
