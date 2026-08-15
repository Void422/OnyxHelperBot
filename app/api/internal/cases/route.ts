import { createModerationCase, scheduleTemporaryAction } from "@/lib/server/cases";
import { requireServiceToken } from "@/lib/server/auth";
import { ApiError, apiFailure, json, readJson } from "@/lib/server/http";
import { internalCaseSchema } from "@/packages/core/src/validation";

export async function POST(request: Request) {
  try {
    requireServiceToken(request);
    const parsed = internalCaseSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(400, "The moderation record is incomplete.", "validation_failed", parsed.error.flatten());
    const moderationCase = await createModerationCase(parsed.data);
    if (parsed.data.expiresAt) {
      const reversal = parsed.data.action === "ban" || parsed.data.action === "tempban" ? "unban" : parsed.data.action === "timeout" ? "untimeout" : null;
      if (reversal) {
        await scheduleTemporaryAction({
          guildId: parsed.data.guildId,
          userId: parsed.data.targetUserId,
          action: reversal,
          dueAt: parsed.data.expiresAt,
        });
      }
    }
    return json({ case: moderationCase }, { status: 201 });
  } catch (error) {
    return apiFailure(error);
  }
}
