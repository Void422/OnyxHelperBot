import type { LevelCurve } from "./rank-ladders";

export interface XpCurveSettings {
  curve?: LevelCurve;
  baseXp?: number;
  growthXp?: number;
}

export type XpCurveInput = LevelCurve | XpCurveSettings;

const CURVE_DEFAULTS: Record<LevelCurve, { baseXp: number; growthXp: number }> = {
  standard: { baseXp: 100, growthXp: 250 },
  grind: { baseXp: 160, growthXp: 400 },
  legendary: { baseXp: 240, growthXp: 600 },
  custom: { baseXp: 100, growthXp: 250 },
};

export function resolveXpCurve(input: XpCurveInput = "standard") {
  const settings = typeof input === "string" ? { curve: input } : input;
  const curve = settings.curve ?? "standard";
  const defaults = CURVE_DEFAULTS[curve];
  if (curve !== "custom") return { curve, ...defaults };
  return {
    curve,
    baseXp: Number.isInteger(settings.baseXp) && (settings.baseXp ?? 0) >= 1 ? settings.baseXp! : defaults.baseXp,
    growthXp: Number.isInteger(settings.growthXp) && (settings.growthXp ?? -1) >= 0 ? settings.growthXp! : defaults.growthXp,
  };
}

export function xpForLevel(level: number, curve: XpCurveInput = "standard"): number {
  if (!Number.isInteger(level) || level < 0) throw new RangeError("Level must be a non-negative integer.");
  const { baseXp, growthXp } = resolveXpCurve(curve);
  return Math.floor(baseXp * level + (growthXp * level * (level - 1)) / 2);
}

export function levelFromXp(xp: number, curve: XpCurveInput = "standard"): number {
  if (!Number.isFinite(xp) || xp <= 0) return 0;
  let low = 0;
  let high = 1;
  while (xpForLevel(high, curve) <= xp) high *= 2;
  while (low + 1 < high) {
    const middle = Math.floor((low + high) / 2);
    if (xpForLevel(middle, curve) <= xp) low = middle;
    else high = middle;
  }
  return low;
}

export function levelProgress(xp: number, curve: XpCurveInput = "standard") {
  const level = levelFromXp(xp, curve);
  const currentFloor = xpForLevel(level, curve);
  const nextFloor = xpForLevel(level + 1, curve);
  return {
    level,
    current: Math.max(0, xp - currentFloor),
    required: nextFloor - currentFloor,
    percent: Math.min(100, Math.floor(((xp - currentFloor) / (nextFloor - currentFloor)) * 100)),
  };
}
