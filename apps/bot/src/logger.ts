import pino from "pino";
import { config } from "./config";

export const logger = pino({
  name: "onyx-bot",
  level: config.LOG_LEVEL,
  redact: {
    paths: ["token", "accessToken", "refreshToken", "req.headers.authorization", "authorization"],
    censor: "[redacted]",
  },
  base: { service: "onyx-bot" },
});
