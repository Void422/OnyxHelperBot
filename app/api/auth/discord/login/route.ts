import { randomToken } from "@/lib/server/crypto";
import { apiFailure } from "@/lib/server/http";
import { publicAppUrl, requireRuntimeValue } from "@/lib/server/runtime";

export async function GET(request: Request) {
  try {
    const state = randomToken(24);
    const appUrl = publicAppUrl(request);
    const requestedReturn = new URL(request.url).searchParams.get("returnTo") ?? "/dashboard";
    const returnTo = requestedReturn === "/appeal" ? "/appeal" : "/dashboard";
    const authorize = new URL("https://discord.com/oauth2/authorize");
    authorize.search = new URLSearchParams({
      client_id: requireRuntimeValue("DISCORD_CLIENT_ID"),
      response_type: "code",
      redirect_uri: `${appUrl}/api/auth/discord/callback`,
      scope: "identify guilds",
      state,
      prompt: "none",
    }).toString();
    const secure = new URL(request.url).protocol === "https:";
    const headers = new Headers({ location: authorize.toString(), "cache-control": "no-store" });
    headers.append("set-cookie", `onyx_oauth_state=${state}; Path=/api/auth/discord/callback; HttpOnly; SameSite=Lax; Max-Age=600${secure ? "; Secure" : ""}`);
    headers.append("set-cookie", `onyx_oauth_return=${encodeURIComponent(returnTo)}; Path=/api/auth/discord/callback; HttpOnly; SameSite=Lax; Max-Age=600${secure ? "; Secure" : ""}`);
    return new Response(null, { status: 302, headers });
  } catch (error) {
    return apiFailure(error);
  }
}
