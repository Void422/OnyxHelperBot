const BASE_XP = 100;
const GROWTH_XP = 25;

export function xpForLevel(level: number): number {
  if (!Number.isInteger(level) || level < 0) throw new RangeError("Level must be a non-negative integer.");
  return BASE_XP * level * level + GROWTH_XP * level * (level - 1);
}

export function levelFromXp(xp: number): number {
  if (!Number.isFinite(xp) || xp <= 0) return 0;
  let low = 0;
  let high = 1;
  while (xpForLevel(high) <= xp) high *= 2;
  while (low + 1 < high) {
    const middle = Math.floor((low + high) / 2);
    if (xpForLevel(middle) <= xp) low = middle;
    else high = middle;
  }
  return low;
}

export function levelProgress(xp: number) {
  const level = levelFromXp(xp);
  const currentFloor = xpForLevel(level);
  const nextFloor = xpForLevel(level + 1);
  return {
    level,
    current: Math.max(0, xp - currentFloor),
    required: nextFloor - currentFloor,
    percent: Math.min(100, Math.floor(((xp - currentFloor) / (nextFloor - currentFloor)) * 100)),
  };
}
