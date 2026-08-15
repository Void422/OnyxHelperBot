import type { LevelCurve } from "./rank-ladders";

const BASE_XP = 100;
const GROWTH_XP = 25;
const CURVE_MULTIPLIERS: Record<LevelCurve, number> = { standard: 1, grind: 1.6, legendary: 2.4 };

export function xpForLevel(level: number, curve: LevelCurve = "standard"): number {
  if (!Number.isInteger(level) || level < 0) throw new RangeError("Level must be a non-negative integer.");
  return Math.floor((BASE_XP * level * level + GROWTH_XP * level * (level - 1)) * CURVE_MULTIPLIERS[curve]);
}

export function levelFromXp(xp: number, curve: LevelCurve = "standard"): number {
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

export function levelProgress(xp: number, curve: LevelCurve = "standard") {
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
