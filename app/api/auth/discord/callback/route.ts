import { createSession, sessionCookie } from "@/lib/server/auth";
import { constantTimeEqual } from "@/lib/server/crypto";
import { exchangeDiscordCode, fetchDiscordGuilds, fetchDiscordIdentity } from "@/lib/server/discord";
import { ApiError, apiFailure } from "@/lib/server/http";
import { publicAppUrl } from "@/lib/server/runtime";

function cookie(request: Request, name: string) {
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return null;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code") ?? "";
    const state = url.searchParams.get("state") ?? "";
    const expected = cookie(request, "onyx_oauth_state") ?? "";
    if (!code || !state || !expected || !constantTimeEqual(state, expected)) {
      throw new ApiError(400, "That sign-in request expired. Start again from the dashboard.", "oauth_state_failed");
    }
    const appUrl = publicAppUrl(request);
    const token = await exchangeDiscordCode(code, `${appUrl}/api/auth/discord/callback`);
    const [user, guilds] = await Promise.all([fetchDiscordIdentity(token.access_token), fetchDiscordGuilds(token.access_token)]);
    const sessionId = await createSession({ token, user, guilds });
    const returnTo = cookie(request, "onyx_oauth_return") === "/appeal" ? "/appeal" : "/dashboard";
    const headers = new Headers({ location: `${appUrl}${returnTo}`, "cache-control": "no-store" });
    headers.append("set-cookie", sessionCookie(sessionId, request));
    headers.append("set-cookie", "onyx_oauth_state=; Path=/api/auth/discord/callback; HttpOnly; SameSite=Lax; Max-Age=0");
    headers.append("set-cookie", "onyx_oauth_return=; Path=/api/auth/discord/callback; HttpOnly; SameSite=Lax; Max-Age=0");
    return new Response(null, { status: 302, headers });
  } catch (error) {
    return apiFailure(error);
  }
}
