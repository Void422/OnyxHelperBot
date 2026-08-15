import { env } from "cloudflare:workers";
import { requireServiceToken } from "@/lib/server/auth";
import { apiFailure, json } from "@/lib/server/http";

export async function POST(request: Request) {
  try {
    requireServiceToken(request);
    const now = Date.now();
    const leaseUntil = now + 60_000;
    const due = await env.DB.prepare(
      `UPDATE temporary_actions
       SET status = 'processing', lease_until = ?2, attempts = attempts + 1, updated_at = ?1
       WHERE id IN (
         SELECT id FROM temporary_actions
         WHERE (status = 'pending' OR (status = 'processing' AND lease_until <= ?1)) AND due_at <= ?1
         ORDER BY due_at ASC LIMIT 20
       )
       RETURNING *`,
    )
      .bind(now, leaseUntil)
      .all();
    return json({ jobs: due.results });
  } catch (error) {
    return apiFailure(error);
  }
}
