import type { CountingSettings } from "./domain";
import type { XpCurveSettings } from "./leveling";

export const defaultCountingSettings = {
  enabled: false,
  baseAward: 5,
  bonusEvery: 100,
  bonusAward: 5,
  maximumAward: 0,
  levelBaseXp: 100,
  levelGrowthXp: 250,
  levelGrowthPercent: 0,
} as const;

const maximumStoredCountingXp = 2_000_000_000;

export function parseCountingNumber(content: string): number | null {
  const normalized = content.trim();
  if (!/^\d[\d, _]*$/.test(normalized)) return null;
  const digits = normalized.replace(/[,_ ]/g, "");
  if (!digits || (digits.length > 1 && digits.startsWith("0"))) return null;
  const value = Number(digits);
  return Number.isSafeInteger(value) && value >= 1 ? value : null;
}

export function normalizeCountingEmoji(value: string): string {
  const normalized = value.trim();
  const customEmoji = normalized.match(/^<a?:[A-Za-z0-9_]{2,32}:(\d{17,20})>$/);
  return customEmoji?.[1] ?? normalized;
}

export function resolveCountingSettings(settings?: CountingSettings) {
  return { ...defaultCountingSettings, ...settings };
}

export function countingAwardForNumber(countNumber: number, settings?: CountingSettings): number {
  if (!Number.isSafeInteger(countNumber) || countNumber < 1) throw new RangeError("Count number must be a positive safe integer.");
  const resolved = resolveCountingSettings(settings);
  const bonusEvery = Number.isSafeInteger(resolved.bonusEvery) && resolved.bonusEvery >= 1 ? resolved.bonusEvery : defaultCountingSettings.bonusEvery;
  const uncapped = resolved.baseAward + Math.floor(countNumber / bonusEvery) * resolved.bonusAward;
  const configuredCap = resolved.maximumAward > 0 ? resolved.maximumAward : maximumStoredCountingXp;
  return Math.min(uncapped, configuredCap, maximumStoredCountingXp);
}

export function countingLevelCurve(settings?: CountingSettings): XpCurveSettings {
  const resolved = resolveCountingSettings(settings);
  return {
    curve: "custom",
    baseXp: resolved.levelBaseXp,
    growthXp: resolved.levelGrowthXp,
    growthPercent: resolved.levelGrowthPercent,
  };
}
