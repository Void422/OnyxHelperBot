import { once } from "node:events";
import { Events } from "discord.js";
import { OnyxApiClient } from "./api-client";
import { createOnyxClient } from "./client";
import { config } from "./config";
import { startScheduler } from "./jobs/scheduler";
import { logger } from "./logger";

const api = new OnyxApiClient();
const client = createOnyxClient(api);
let stopScheduler: (() => void) | undefined;
let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ event: "shutdown.started", signal });
  stopScheduler?.();
  client.destroy();
  logger.info({ event: "shutdown.completed" });
  await logger.flush();
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.on("unhandledRejection", (error) => logger.error({ event: "process.unhandled_rejection", error }));
process.on("uncaughtException", (error) => logger.fatal({ event: "process.uncaught_exception", error }));

try {
  const ready = once(client, Events.ClientReady);
  await client.login(config.DISCORD_TOKEN);
  if (!client.isReady()) await ready;
  if (!client.isReady()) throw new Error("Discord client did not reach the ready state.");
  stopScheduler = startScheduler(client, api);
} catch (error) {
  logger.fatal({ event: "startup.failed", error });
  process.exitCode = 1;
}
