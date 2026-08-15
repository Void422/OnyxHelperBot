# Onyx

[Live dashboard](https://onyx-helper.quatnumgaming.chatgpt.site) · [GitHub Pages mirror](https://void422.github.io/OnyxHelperBot/) · [Project status](docs/PROJECT_STATUS.md)

Onyx is a multi-server Discord management platform: a Discord bot, a guild-scoped web dashboard, a durable API, and an external moderation appeal flow. It is built for real community operations rather than command-count demos.

The current product includes:

- Discord OAuth2 sign-in and live Manage Server authorization
- server selector with least-privilege bot installation links
- 51 top-level slash commands with 78 configurable command actions across moderation, administration, community, and utilities
- moderation cases, bans, kicks, softbans, warnings, timeouts, history, staff notes, purges, locks, roles, nicknames, and slowmode
- persistent temporary-action recovery after bot restarts
- configurable warning escalation
- event-style giveaways with role and level gates, boosted entries, rerolls, winner roles, and timed rewards
- private tickets with panels, claims, participants, close/reopen, routed logs, and transcript export
- persistent reminders, suggestions with staff decisions, welcome/goodbye messages, delayed autoroles, and starboard promotion
- XP anti-spam, rank and leaderboard views, staff adjustments, exclusions, announcements, and level-role rewards
- nine configurable automod rules with exemptions and accountable delete/warn/timeout/kick/ban/notify actions
- public appeal submission plus staff review, decisions, and authorized unban
- dedicated dashboard workspaces for commands, automod, tickets, levels, message templates, community, Discord log routing, cases, appeals, giveaways, and audit history
- per-command enable/cooldown overrides and safe Discord message/embed customization with live previews
- structured logging, graceful shutdown, health checks, migrations, tests, and CI

The long-form roadmap remains intentionally broader than the implemented release. [Project status](docs/PROJECT_STATUS.md) records the exact boundary.

## Architecture

The Vinext dashboard/API runs as a Cloudflare Worker and owns a D1 database. The separate Node.js Discord gateway process communicates with authenticated internal API routes. Browser code never receives Discord tokens, the bot token, the service token, or database access.

Read [the architecture](docs/ARCHITECTURE.md) for runtime and security boundaries.

## Prerequisites

- Node.js 22.13 or newer
- a Discord application with a bot user
- Cloudflare/Sites access for the dashboard and D1 database
- a persistent Node.js host or container for the Discord gateway process

## Local setup

1. Install dependencies:

   ```bash
   npm ci
   ```

2. Copy `.env.example` to `.env` and add local values. Use different random values for `SESSION_SECRET` and `ONYX_SERVICE_TOKEN`; each should be at least 32 characters. Never put secrets in `env.txt`, source files, or Discord messages.

3. Apply the local database migration:

   ```bash
   npm run db:migrate:local
   ```

4. Start the dashboard/API:

   ```bash
   npm run dev
   ```

5. In another terminal, deploy development-guild commands and start the bot:

   ```bash
   npm run commands:deploy
   npm run dev:bot
   ```

Guild-scoped development commands update immediately. Remove `DEVELOPMENT_GUILD_ID` only when the commands are ready for global deployment.

## Discord application setup

1. Create an application and bot in the Discord Developer Portal.
2. Add this OAuth2 redirect exactly: `${APP_URL}/api/auth/discord/callback`.
3. The dashboard login requests `identify` and `guilds` only.
4. The generated install link requests `bot` and `applications.commands`, plus the implemented module permissions. It deliberately does not request Administrator.
5. Enable Server Members Intent and Message Content Intent. Members are needed for hierarchy, age, roles, and leveling; message content is needed for automod and anti-spam XP. Voice State and reaction events use standard non-privileged gateway intents.
6. Place the Onyx bot role above every role it must moderate or assign.

Bot tokens and OAuth tokens are passwords. Rotate them immediately if exposed.

## Commands

```text
npm run dev                 Dashboard/API development server
npm run dev:bot             Bot development watcher
npm run db:generate         Generate a migration after schema changes
npm run db:migrate:local    Apply migrations to local D1
npm run commands:deploy     Deploy guild or global slash commands
npm run lint                Lint all source
npm run typecheck           Type-check site and bot
npm test                    Run domain and security logic tests
npm run build               Build the dashboard worker
npm run build:bot           Bundle the production bot process
npm run check               Run the complete quality gate
```

The [command catalog](docs/COMMANDS.md) lists permissions and module ownership.

## Production

See [deployment](docs/DEPLOYMENT.md) for dashboard publication, bot deployment, migrations, health checks, backups, and the optional GNU Screen workflow.

## Security

Every dashboard mutation verifies an authenticated Discord session, current guild permission, same-origin request, CSRF token, input schema, and guild scope. Bot routes use a separate service token. OAuth tokens are encrypted before database storage.

See [security notes](docs/SECURITY.md) for the trust model and reporting guidance.

## Troubleshooting

- **A server is missing:** confirm the signed-in Discord account has Manage Server or Administrator, then sign out and back in.
- **Role or moderation action fails:** move the Onyx role above the target role and confirm the specific Discord permission is granted.
- **OAuth returns an error:** confirm `APP_URL` and the Developer Portal redirect match exactly, including protocol and path.
- **Dashboard loads but shows setup required:** configure the dashboard environment variables and redeploy.
- **Bot cannot reach data service:** verify `ONYX_API_URL` and that both processes use the same `ONYX_SERVICE_TOKEN`.
- **A scheduled action is late:** check bot logs and `/api/health`; the persistent job will be retried after the service recovers.
