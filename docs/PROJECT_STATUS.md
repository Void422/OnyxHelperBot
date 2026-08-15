# Project status

Last updated: 2026-08-15

## Completed in this release

- Sites-compatible Vinext dashboard/API and a separately deployable Discord.js gateway process.
- A 24-table indexed D1 schema covering identity, guild configuration, moderation, appeals, giveaways, levels, tickets, reminders, suggestions, starboard state, audit events, and durable rate limits/jobs.
- Discord OAuth2 login, opaque HttpOnly sessions, encrypted OAuth tokens, live Manage Server/Administrator checks, CSRF and same-origin mutation protection, and authenticated bot-to-API routes.
- 51 top-level slash commands with 78 independently configurable actions. The dashboard catalog and bot registry were compared directly: zero missing handlers and zero duplicates.
- Complete moderation records for cases, warnings, reason corrections, member history, private staff notes, temporary actions, nickname actions, and warning escalation.
- Durable giveaway creation, listing, inspection, editing, pause/resume, manual ending, scheduled ending, rerolls, weighted entries, and customizable winner messages.
- Durable ticket records, private channel creation, panels, claims, close/reopen, participants, rename, transcript export, staff access, and routed ticket logs.
- Persistent reminders, suggestion voting/status workflow, discussion threads, welcome/goodbye delivery, delayed human/bot autoroles, and reaction-based starboard promotion.
- XP anti-spam policy, ranks, leaderboard, audited XP adjustment, channel/role exclusions, level role rewards, and customizable level announcements.
- Nine configurable automod rule types with thresholds, exemptions, delete/warn/timeout/kick/ban/notify actions, and Discord alerts.
- Dedicated dashboard workspaces for Commands, Automod, Tickets, Levels, Message Studio, Community, Discord Logs, Moderation, Appeals, Giveaways, Audit, and server-wide settings.
- Safe message placeholders with plain content, embed title/body/footer, colors, HTTPS media, and live Discord-style previews for welcome, goodbye, warning, ticket, level, and giveaway messages.
- Category-based Discord logs for moderation, automod, messages, members, server structure, voice, tickets, and giveaways, plus a separate durable application audit trail.
- Responsive onyx-and-amber visual system, custom social preview, structured logging, graceful shutdown, CI, deployment scripts, and security/architecture documentation.
- Quality gate: lint and both TypeScript targets pass; 17 domain/security tests and 2 rendered-page tests pass; dashboard and bot production builds pass.

## Intentionally not represented as complete

The original brief includes a longer multi-release roadmap. These areas are not exposed as working modules in this release:

- self-role menus, custom commands, polls, economy, birthdays, temporary voice channels, verification, game/account integrations, and voice-time rewards
- advanced anti-nuke orchestration, external domain reputation, raid-mode heuristics beyond configured account/link rules, and cross-guild threat intelligence
- object-storage transcript archives and dashboard transcript retention; current transcript export is generated on demand from the latest 100 Discord messages
- localization packs, full product analytics, horizontal multi-instance scheduler coordination beyond leases, and formal load testing

The unimplemented role-menu module is deliberately absent from the editable dashboard module list.

## Known limitations

- The storage adapter targets Cloudflare D1. Shared domain logic is storage-independent, but a PostgreSQL adapter is not included.
- Discord global command changes can take time to propagate. Development-guild registration remains available for immediate testing.
- Presence is global to one Discord bot user. On a multi-guild installation, the process uses the first connected guild's configured rotation.
- Uploaded files and transcript blobs require object storage and a retention policy; neither is silently retained by the worker.
- Full Discord-side behavioral verification requires exercising privileged actions in a test channel with appropriate role hierarchy. Automated checks validate registration, schemas, builds, and domain behavior without mutating a live community.

## Deployment status

- Dashboard/API: hosted through Sites at `https://onyx-helper.quatnumgaming.chatgpt.site` with secrets managed outside source control and D1 bound as `DB`.
- Bot: deployed separately to the supplied Linux host under PM2 using an owner-only environment file.
- GitHub: public source at `https://github.com/Void422/OnyxHelperBot`; GitHub Pages mirror at `https://void422.github.io/OnyxHelperBot/`.
