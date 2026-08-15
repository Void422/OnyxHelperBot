# Project status

Last updated: 2026-08-15

## Completed in this release

- Sites-compatible Vinext dashboard/API and a separately deployable Discord.js bot.
- A 23-table, indexed D1 schema and generated migration covering identity, guild configuration, moderation, appeals, giveaways, levels, tickets, reminders, suggestions, audit events, and durable rate limits.
- Discord OAuth2 login, opaque HttpOnly sessions, encrypted OAuth tokens, live Manage Server/Administrator checks, CSRF and same-origin mutation protection, and authenticated bot-to-API routes.
- Guild registration, live Discord channel/role resources, settings, overview, moderation cases, appeals, giveaways, audit history, health, XP, warnings, and persistent scheduler APIs.
- Permission- and hierarchy-safe commands for bans, unbans, kicks, timeouts, warnings, warning history, purges, locks, slowmode, giveaways, rank, help, ping, uptime, avatar, user info, and server info.
- Persistent temporary-action reversal, configurable warning escalation, giveaway entry/draw recovery, XP anti-spam and level roles, and foundational automod actions/exemptions.
- Responsive landing, server selector, guild overview, configuration, moderation, appeals, giveaways, audit, and public appeal interfaces backed by real APIs.
- Structured bot logging, graceful shutdown, Docker packaging, CI, architecture/security/deployment documentation, a command catalog, and a custom social card.
- Quality gate: lint and both TypeScript targets pass; 13 domain/security tests and 2 rendered-page tests pass; dashboard and bot production builds pass; the production dependency audit reports zero known vulnerabilities.

## Intentionally not represented as complete

The supplied product brief is a multi-release roadmap. These requested areas have schema or extension points but are not complete product features in this release:

- ticket commands, transcript generation/storage, ticket dashboard, and R2 retention controls
- polls, suggestion voting/workflow, starboard, reminders, custom commands, embed builder, and welcome/autorole execution
- full raid-mode heuristics, link/domain reputation, anti-nuke, detailed log routing, and every moderation command in the long-tail command list
- optional modules such as server economy, self-role menus, temporary voice, birthdays, verification, voice tracking, and game/account integrations
- localization packs, installable command/module toggles for every planned feature, and full usage analytics
- horizontal multi-instance job coordination beyond the implemented leases, production monitoring integration, and load testing

No dashboard control or metric is shown for an unimplemented subsystem.

## External requirements before live operation

- `DISCORD_TOKEN`
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- production `APP_URL` and an exactly matching Discord OAuth redirect
- `SESSION_SECRET` with at least 32 random characters
- `ONYX_SERVICE_TOKEN` shared only by the API and bot
- a persistent Node.js 22+ bot host

## Known limitations

- The current storage adapter targets Cloudflare D1 so the dashboard and API can ship as one worker. Shared domain logic is storage-independent, but a PostgreSQL adapter is not included.
- Discord actions, OAuth callbacks, command registration, and restart recovery cannot be proven against a live guild without application credentials and a test server.
- Uploaded images and transcript blobs are disabled until object storage and retention policy are configured.
- The full development-only audit reports notices in Vinext's image inspection dependency and Drizzle Kit's legacy loader. These packages do not ship in the dashboard worker or bot runtime; `npm audit --omit=dev` is clean. Upstream currently offers no compatible patched release for those two tool-only paths.

## Deployment status

- Dashboard/API: private production deployment succeeded at `https://onyx-helper.quatnumgaming.chatgpt.site`; Discord secrets remain before live guild operation.
- Bot: production bundle and container definition verified; not connected to Discord or deployed to a persistent host.
- Database: schema and migration verified locally and against the hosted D1 binding; all 23 application tables are present.
