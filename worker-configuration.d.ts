declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    ASSETS: Fetcher;
    DISCORD_CLIENT_ID?: string;
    DISCORD_CLIENT_SECRET?: string;
    DISCORD_TOKEN?: string;
    APP_URL?: string;
    SESSION_SECRET?: string;
    ONYX_SERVICE_TOKEN?: string;
  }
}
