import { loadEnvFile } from "node:process";
import { z } from "zod";

try {
  loadEnvFile();
} catch {
  // Production hosts normally inject variables directly; a local .env is optional.
}

const schema = z.object({
  DISCORD_TOKEN: z.string().min(20),
  DISCORD_CLIENT_ID: z.string().regex(/^\d{17,20}$/),
  ONYX_API_URL: z.string().url().transform((value) => value.replace(/\/$/, "")),
  ONYX_SERVICE_TOKEN: z.string().min(32),
  DEVELOPMENT_GUILD_ID: z.string().regex(/^\d{17,20}$/).optional(),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const missing = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
  throw new Error(`Onyx bot configuration is incomplete: ${missing}`);
}

export const config = parsed.data;
