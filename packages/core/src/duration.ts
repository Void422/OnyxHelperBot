const UNIT_MS: Record<string, number> = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  w: 604_800_000,
};

export function parseDuration(value: string, maximumMs = 28 * UNIT_MS.d): number | null {
  const match = /^\s*(\d+)\s*([smhdw])\s*$/i.exec(value);
  if (!match) return null;
  const duration = Number(match[1]) * UNIT_MS[match[2].toLowerCase()];
  if (!Number.isSafeInteger(duration) || duration <= 0 || duration > maximumMs) return null;
  return duration;
}

export function formatDuration(durationMs: number) {
  const candidates = [
    [UNIT_MS.w, "week"],
    [UNIT_MS.d, "day"],
    [UNIT_MS.h, "hour"],
    [UNIT_MS.m, "minute"],
    [UNIT_MS.s, "second"],
  ] as const;
  for (const [unit, label] of candidates) {
    if (durationMs >= unit && durationMs % unit === 0) {
      const count = durationMs / unit;
      return `${count} ${label}${count === 1 ? "" : "s"}`;
    }
  }
  return `${Math.ceil(durationMs / 1000)} seconds`;
}
