import { discordAvatarUrl, discordInviteUrl } from "@/lib/server/discord";
import { getSession } from "@/lib/server/auth";
import { apiFailure, json } from "@/lib/server/http";
import { dashboardConfigured } from "@/lib/server/runtime";

export async function GET(request: Request) {
  try {
    const session = await getSession(request);
    return json({
      configured: dashboardConfigured(),
      authenticated: Boolean(session),
      csrfToken: session?.csrfToken ?? null,
      inviteUrl: dashboardConfigured() ? discordInviteUrl() : null,
      user: session
        ? {
            id: session.userId,
            username: session.username,
            displayName: session.displayName,
            avatarUrl: discordAvatarUrl({ id: session.userId, avatar: session.avatarHash }),
          }
        : null,
    });
  } catch (error) {
    return apiFailure(error);
  }
}
