import { env } from "cloudflare:workers";
import { ApiError } from "./http";

export async function enforceRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const result = await env.DB.prepare(
    `INSERT INTO rate_limits (key, count, window_ends_at, updated_at)
     VALUES (?1, 1, ?2, ?3)
     ON CONFLICT(key) DO UPDATE SET
       count = CASE WHEN window_ends_at <= ?3 THEN 1 ELSE count + 1 END,
       window_ends_at = CASE WHEN window_ends_at <= ?3 THEN ?2 ELSE window_ends_at END,
       updated_at = ?3
     RETURNING count, window_ends_at`,
  )
    .bind(key, now + windowMs, now)
    .first<{ count: number; window_ends_at: number }>();

  if (result && result.count > limit) {
    const retryAfter = Math.max(1, Math.ceil((result.window_ends_at - now) / 1_000));
    throw new ApiError(429, `Please wait ${retryAfter} seconds before trying again.`, "rate_limited", { retryAfter });
  }
}
