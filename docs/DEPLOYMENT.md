# Deployment

The dashboard/API and Discord gateway are separate processes. Deploying one does not start the other.

## Dashboard and API

1. Provision the Sites deployment and its D1 binding named `DB`.
2. Configure `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_TOKEN`, `APP_URL`, `SESSION_SECRET`, and `ONYX_SERVICE_TOKEN` through hosted secret management.
3. Set the Discord OAuth redirect to `${APP_URL}/api/auth/discord/callback`.
4. Apply `drizzle/` migrations to the production D1 database.
5. Build and publish the worker.
6. Verify `/api/health`, the landing page, Discord login, server selection, and one authorized settings save.

Do not publish secrets through client-prefixed environment variables.

## Discord bot

Build the bundle:

```bash
npm ci
npm run build:bot
```

The bot host requires `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `ONYX_API_URL`, `ONYX_SERVICE_TOKEN`, and optionally `LOG_LEVEL`. Run:

```bash
npm run start:bot
```

Deploy commands once with `npm run commands:deploy`. Do not redeploy commands during every process start.

## Container

```bash
docker build -f apps/bot/Dockerfile -t onyx-bot .
docker run --restart unless-stopped --env-file .env onyx-bot
```

Use the host's secret store in preference to a long-lived `.env` file.

## GNU Screen option

Use Screen only on a conventional Linux host where no native service manager or container supervisor is available.

```bash
screen -ls
screen -S onyx-bot -dm bash -lc 'cd ~/apps/onyx && npm run start:bot >> logs/bot.log 2>&1'
screen -r onyx-bot
screen -S onyx-bot -X quit
```

Always run `screen -ls` first. If `onyx-bot` already exists, inspect or restart it; never launch a second bot with the same token.

## Health and verification

- `GET /api/health` reports API/database availability without infrastructure detail.
- Bot logs should include `discord.ready` and the expected guild count.
- Run a development-guild `/ping`, then a permission-safe case action such as `/slowmode seconds:0` in a test channel.
- Restart the bot while a future temporary action and giveaway exist, then confirm the scheduler completes each once.

## Backups

Export D1 on a schedule appropriate to the community's volume and before destructive migrations. Store encrypted exports outside the public web root and outside the application repository. Retain several daily copies and periodically test restore into a separate database.

Ticket transcript object storage is not enabled in the current release. Configure R2 and a retention policy before enabling transcript blobs.

## Rollback

Keep the previous worker deployment and bot image/bundle. Roll back application code first. Do not reverse a database migration unless its down migration has been tested against a copy; forward-fix schema changes when possible.
