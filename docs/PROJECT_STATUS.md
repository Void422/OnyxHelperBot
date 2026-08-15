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

## External requirement before end-to-end OAuth verification

- the exact production callback URL registered in the Discord Developer Portal

## Known limitations

- The current storage adapter targets Cloudflare D1 so the dashboard and API can ship as one worker. Shared domain logic is storage-independent, but a PostgreSQL adapter is not included.
- The bot connection, global command registration, API authentication, and scheduler startup are verified against one live guild. The OAuth client secret is installed and the authorization redirect is verified; the callback and staff-facing actions remain unverified until an interactive Discord login is completed with the production redirect registered.
- Uploaded images and transcript blobs are disabled until object storage and retention policy are configured.
- The full development-only audit reports notices in Vinext's image inspection dependency and Drizzle Kit's legacy loader. These packages do not ship in the dashboard worker or bot runtime; `npm audit --omit=dev` is clean. Upstream currently offers no compatible patched release for those two tool-only paths.

## Deployment status

- Dashboard/API: public production deployment is healthy at `https://onyx-helper.quatnumgaming.chatgpt.site`; all runtime secrets are installed through hosted secret management and the OAuth login route correctly targets Discord.
- Bot: running on the supplied Linux host under one PM2 process with an isolated Node.js 22 runtime, owner-only environment file, globally registered commands, one connected guild, and a healthy scheduler/API link.
- Database: schema and migration verified locally and against the hosted D1 binding; all 23 application tables are present.
- GitHub: the public source repository is live at `https://github.com/Void422/OnyxHelperBot`; its Pages mirror is deployed at `https://void422.github.io/OnyxHelperBot/` and both GitHub quality workflows pass.
