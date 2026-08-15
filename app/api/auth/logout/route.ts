import { deleteSession, requireSession, requireCsrf, sessionCookie } from "@/lib/server/auth";
import { apiFailure, json } from "@/lib/server/http";

export async function POST(request: Request) {
  try {
    const session = await requireSession(request);
    requireCsrf(request, session);
    await deleteSession(request);
    return json({ ok: true }, { headers: { "set-cookie": sessionCookie("", request, 0) } });
  } catch (error) {
    return apiFailure(error);
  }
}
