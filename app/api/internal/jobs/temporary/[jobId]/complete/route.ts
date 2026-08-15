import { env } from "cloudflare:workers";
import { requireServiceToken } from "@/lib/server/auth";
import { ApiError, apiFailure, json, readJson } from "@/lib/server/http";
import { z } from "zod";

type Context = { params: Promise<{ jobId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    requireServiceToken(request);
    const parsed = z.object({ success: z.boolean(), error: z.string().max(500).optional() }).safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(400, "The job result is invalid.", "validation_failed");
    const { jobId } = await context.params;
    await env.DB.prepare(
      `UPDATE temporary_actions
       SET status = ?2, completed_at = CASE WHEN ?2 = 'completed' THEN ?3 ELSE completed_at END,
           last_error = ?4, lease_until = NULL, updated_at = ?3
       WHERE id = ?1 AND status = 'processing'`,
    )
      .bind(jobId, parsed.data.success ? "completed" : "failed", Date.now(), parsed.data.error ?? null)
      .run();
    return json({ ok: true });
  } catch (error) {
    return apiFailure(error);
  }
}
