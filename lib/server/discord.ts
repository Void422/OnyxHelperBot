import { ApiError } from "./http";
import { requireRuntimeValue } from "./runtime";

const DISCORD_API = "https://discord.com/api/v10";

export interface DiscordIdentity {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
}

export interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
}

export interface DiscordTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: "Bearer";
  scope: string;
}

async function discordFetch<T>(path: string, accessToken: string): Promise<T> {
  const response = await fetch(`${DISCORD_API}${path}`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new ApiError(response.status === 401 ? 401 : 502, "Discord could not confirm your account right now.", "discord_api_error");
  }
  return (await response.json()) as T;
}

export async function exchangeDiscordCode(code: string, redirectUri: string): Promise<DiscordTokenResponse> {
  const body = new URLSearchParams({
    client_id: requireRuntimeValue("DISCORD_CLIENT_ID"),
    client_secret: requireRuntimeValue("DISCORD_CLIENT_SECRET"),
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });
  const response = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) throw new ApiError(502, "Discord did not complete the sign-in request.", "oauth_exchange_failed");
  return (await response.json()) as DiscordTokenResponse;
}

export async function refreshDiscordToken(refreshToken: string): Promise<DiscordTokenResponse> {
  const response = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: requireRuntimeValue("DISCORD_CLIENT_ID"),
      client_secret: requireRuntimeValue("DISCORD_CLIENT_SECRET"),
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!response.ok) throw new ApiError(401, "Your Discord session has expired. Sign in again to continue.", "session_refresh_failed");
  return (await response.json()) as DiscordTokenResponse;
}

export const fetchDiscordIdentity = (token: string) => discordFetch<DiscordIdentity>("/users/@me", token);
export const fetchDiscordGuilds = (token: string) => discordFetch<DiscordGuild[]>("/users/@me/guilds", token);

export function discordAvatarUrl(user: Pick<DiscordIdentity, "id" | "avatar">) {
  return user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128` : null;
}

export function discordGuildIconUrl(guild: Pick<DiscordGuild, "id" | "icon">) {
  return guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128` : null;
}

export function discordInviteUrl(guildId?: string) {
  // Requests only the permissions used by implemented modules; Onyx never asks for Administrator.
  const permissions =
    (1n << 1n) |
    (1n << 2n) |
    (1n << 4n) |
    (1n << 6n) |
    (1n << 10n) |
    (1n << 11n) |
    (1n << 13n) |
    (1n << 14n) |
    (1n << 15n) |
    (1n << 16n) |
    (1n << 27n) |
    (1n << 28n) |
    (1n << 40n);
  const url = new URL("https://discord.com/oauth2/authorize");
  url.search = new URLSearchParams({
    client_id: requireRuntimeValue("DISCORD_CLIENT_ID"),
    scope: "bot applications.commands",
    permissions: permissions.toString(),
    ...(guildId ? { guild_id: guildId, disable_guild_select: "true" } : {}),
  }).toString();
  return url.toString();
}
