import { env } from "cloudflare:workers";

export type RuntimeSecret =
  | "DISCORD_CLIENT_ID"
  | "DISCORD_CLIENT_SECRET"
  | "DISCORD_TOKEN"
  | "APP_URL"
  | "SESSION_SECRET"
  | "ONYX_SERVICE_TOKEN";

export function runtimeValue(name: RuntimeSecret): string | undefined {
  const value = env[name];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function requireRuntimeValue(name: RuntimeSecret): string {
  const value = runtimeValue(name);
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

export function publicAppUrl(request?: Request): string {
  const configured = runtimeValue("APP_URL");
  if (configured) return configured.replace(/\/$/, "");
  if (request) return new URL(request.url).origin;
  return "http://localhost:3000";
}

export function dashboardConfigured() {
  return Boolean(
    runtimeValue("DISCORD_CLIENT_ID") &&
      runtimeValue("DISCORD_CLIENT_SECRET") &&
      runtimeValue("SESSION_SECRET"),
  );
}
