import { and, eq, gt } from "drizzle-orm";
import { getDb } from "@/db";
import { oauthSessions, sessionGuilds, users } from "@/db/schema";
import { canManageGuild, DiscordPermission, hasDiscordPermission } from "@/packages/core/src/permissions";
import { constantTimeEqual, decryptSecret, encryptSecret, randomToken } from "./crypto";
import { fetchDiscordGuilds, refreshDiscordToken, type DiscordGuild, type DiscordTokenResponse } from "./discord";
import { ApiError, assertSameOrigin } from "./http";
import { publicAppUrl, requireRuntimeValue, runtimeValue } from "./runtime";

const SESSION_COOKIE = "onyx_session";
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1_000;
const GUILD_CACHE_MS = 2 * 60 * 1_000;

export interface AuthSession {
  id: string;
  userId: string;
  username: string;
  displayName: string | null;
  avatarHash: string | null;
  csrfToken: string;
  encryptedAccessToken: string;
  encryptedRefreshToken: string;
  tokenExpiresAt: Date;
  expiresAt: Date;
}

function parseCookies(request: Request) {
  const cookies = new Map<string, string>();
  for (const pair of (request.headers.get("cookie") ?? "").split(";")) {
    const separator = pair.indexOf("=");
    if (separator > 0) cookies.set(pair.slice(0, separator).trim(), decodeURIComponent(pair.slice(separator + 1).trim()));
  }
  return cookies;
}

export function sessionCookie(value: string, request: Request, maxAge = Math.floor(SESSION_DURATION_MS / 1_000)) {
  const secure = new URL(request.url).protocol === "https:";
  return `${SESSION_COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}

export async function getSession(request: Request): Promise<AuthSession | null> {
  const id = parseCookies(request).get(SESSION_COOKIE);
  if (!id) return null;
  const now = new Date();
  const [row] = await getDb()
    .select({
      id: oauthSessions.id,
      userId: oauthSessions.userId,
      username: users.username,
      displayName: users.displayName,
      avatarHash: users.avatarHash,
      csrfToken: oauthSessions.csrfToken,
      encryptedAccessToken: oauthSessions.encryptedAccessToken,
      encryptedRefreshToken: oauthSessions.encryptedRefreshToken,
      tokenExpiresAt: oauthSessions.tokenExpiresAt,
      expiresAt: oauthSessions.expiresAt,
    })
    .from(oauthSessions)
    .innerJoin(users, eq(users.id, oauthSessions.userId))
    .where(and(eq(oauthSessions.id, id), gt(oauthSessions.expiresAt, now)))
    .limit(1);
  if (!row) return null;
  await getDb().update(oauthSessions).set({ lastSeenAt: now, updatedAt: now }).where(eq(oauthSessions.id, id));
  return row;
}

export async function requireSession(request: Request) {
  const session = await getSession(request);
  if (!session) throw new ApiError(401, "Sign in with Discord to continue.", "authentication_required");
  return session;
}

async function accessToken(session: AuthSession) {
  const secret = requireRuntimeValue("SESSION_SECRET");
  if (session.tokenExpiresAt.getTime() > Date.now() + 30_000) return decryptSecret(session.encryptedAccessToken, secret);

  const refreshToken = await decryptSecret(session.encryptedRefreshToken, secret);
  const refreshed = await refreshDiscordToken(refreshToken);
  const now = new Date();
  await getDb()
    .update(oauthSessions)
    .set({
      encryptedAccessToken: await encryptSecret(refreshed.access_token, secret),
      encryptedRefreshToken: await encryptSecret(refreshed.refresh_token, secret),
      tokenExpiresAt: new Date(now.getTime() + refreshed.expires_in * 1_000),
      updatedAt: now,
    })
    .where(eq(oauthSessions.id, session.id));
  return refreshed.access_token;
}

export async function createSession(input: {
  token: DiscordTokenResponse;
  user: { id: string; username: string; global_name: string | null; avatar: string | null };
  guilds: DiscordGuild[];
}) {
  const database = getDb();
  const now = new Date();
  const secret = requireRuntimeValue("SESSION_SECRET");
  const sessionId = randomToken(32);
  await database
    .insert(users)
    .values({ id: input.user.id, username: input.user.username, displayName: input.user.global_name, avatarHash: input.user.avatar, updatedAt: now })
    .onConflictDoUpdate({ target: users.id, set: { username: input.user.username, displayName: input.user.global_name, avatarHash: input.user.avatar, updatedAt: now } });
  await database.insert(oauthSessions).values({
    id: sessionId,
    userId: input.user.id,
    csrfToken: randomToken(24),
    encryptedAccessToken: await encryptSecret(input.token.access_token, secret),
    encryptedRefreshToken: await encryptSecret(input.token.refresh_token, secret),
    tokenExpiresAt: new Date(now.getTime() + input.token.expires_in * 1_000),
    expiresAt: new Date(now.getTime() + SESSION_DURATION_MS),
    lastSeenAt: now,
  });
  if (input.guilds.length) {
    await database.insert(sessionGuilds).values(
      input.guilds.map((guild) => ({
        sessionId,
        guildId: guild.id,
        name: guild.name,
        iconHash: guild.icon,
        permissions: guild.permissions,
        owner: guild.owner,
        fetchedAt: now,
      })),
    );
  }
  return sessionId;
}

export async function deleteSession(request: Request) {
  const session = await getSession(request);
  if (session) await getDb().delete(oauthSessions).where(eq(oauthSessions.id, session.id));
}

async function cachedGuilds(session: AuthSession) {
  const database = getDb();
  let rows = await database.select().from(sessionGuilds).where(eq(sessionGuilds.sessionId, session.id));
  const newest = rows.reduce((latest, row) => Math.max(latest, row.fetchedAt.getTime()), 0);
  if (Date.now() - newest < GUILD_CACHE_MS && rows.length) return rows;

  const guilds = await fetchDiscordGuilds(await accessToken(session));
  const now = new Date();
  await database.delete(sessionGuilds).where(eq(sessionGuilds.sessionId, session.id));
  if (guilds.length) {
    await database.insert(sessionGuilds).values(
      guilds.map((guild) => ({
        sessionId: session.id,
        guildId: guild.id,
        name: guild.name,
        iconHash: guild.icon,
        permissions: guild.permissions,
        owner: guild.owner,
        fetchedAt: now,
      })),
    );
  }
  rows = await database.select().from(sessionGuilds).where(eq(sessionGuilds.sessionId, session.id));
  return rows;
}

export async function getManageableGuilds(session: AuthSession) {
  return (await cachedGuilds(session)).filter((guild) => canManageGuild(guild.permissions, guild.owner));
}

export async function requireGuildAccess(request: Request, guildId: string, permission = DiscordPermission.ManageGuild) {
  if (!/^\d{17,20}$/.test(guildId)) throw new ApiError(404, "That server could not be found.", "guild_not_found");
  const session = await requireSession(request);
  const guild = (await cachedGuilds(session)).find((candidate) => candidate.guildId === guildId);
  if (!guild || (!guild.owner && !hasDiscordPermission(guild.permissions, permission))) {
    throw new ApiError(403, "You do not have permission to manage this server.", "guild_access_denied");
  }
  return { session, guild };
}

export function requireCsrf(request: Request, session: AuthSession) {
  assertSameOrigin(request, publicAppUrl(request));
  const candidate = request.headers.get("x-onyx-csrf") ?? "";
  if (!constantTimeEqual(candidate, session.csrfToken)) throw new ApiError(403, "Refresh the page and try that change again.", "csrf_failed");
}

export function requireServiceToken(request: Request) {
  const configured = runtimeValue("ONYX_SERVICE_TOKEN");
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!configured || !constantTimeEqual(configured, supplied)) throw new ApiError(401, "The bot service could not be authenticated.", "service_auth_failed");
}
