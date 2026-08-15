# Onyx architecture

Onyx is split by runtime, not by product ownership. The dashboard worker owns the HTTP API and durable state. The Discord gateway process consumes the same API instead of maintaining a second database connection or a competing data model.

## Runtime map

```text
Discord members and staff
        |
        v
apps/bot (discord.js gateway process)
        |  authenticated internal HTTP calls
        v
dashboard/API worker (Vinext on Cloudflare)
        |  prepared, guild-scoped queries
        v
Cloudflare D1

Discord administrators
        |
        v
Discord OAuth2 -> dashboard/API worker -> D1
```

The dashboard and API live at the repository root because the Sites runtime builds that surface directly. `apps/bot` is a separately deployable Node.js process. `packages/core` contains validation, permissions, domain calculations, and message policy shared by both runtimes.

## Security boundaries

- Discord OAuth2 authenticates dashboard users. OAuth state and a same-origin callback guard the authorization flow.
- Sessions are opaque random IDs stored in an HttpOnly cookie. Discord tokens remain server-side and are encrypted before persistence.
- Every guild API handler calls the same server-side guild authorization helper. Manage Guild or Administrator is required for normal configuration; destructive actions may require Administrator.
- Mutations require a per-session CSRF token and a matching request origin.
- Bot-to-API routes require an application service token. The token is never available to browser code.
- Database access is centralized, uses prepared statements through Drizzle, and always scopes guild records by `guildId`.
- Moderation actions still enforce Discord's native permission and role hierarchy at execution time. Dashboard permission never grants the bot a Discord capability it does not have.

## Data model

The schema is organized around explicit records rather than a single untyped settings blob:

- identity: users, OAuth sessions, session guild cache
- tenancy: guilds, guild settings, module settings, log configuration
- moderation: sequential cases, warnings, moderator notes, temporary actions
- community: giveaways and entries, level profiles and rewards, tickets and participants
- workflow: appeals and messages, reminders, suggestions
- safety and audit: automod rules, application audit events, persistent rate-limit buckets

JSON is limited to bounded module-specific configuration, Discord embed payloads, and before/after audit snapshots. Relational records and indexes carry ownership and list-query fields.

## Background work

The bot runs a short polling scheduler. It claims due temporary actions, giveaways, and reminders through atomic API operations, performs the Discord-side action, then records completion. A lease prevents another bot instance from processing the same job after a restart or short overlap.

## Failure model

- Interaction handlers defer before potentially slow operations and return a short public error reference on unexpected failures.
- The bot caches non-sensitive guild configuration briefly, but the API remains authoritative.
- No days-long JavaScript timers are used. Restart recovery comes from persisted due timestamps and job leases.
- OAuth/API errors expose structured, human-readable responses without stack traces or credentials.
- Shutdown handlers stop polling, destroy the Discord client, flush logging, and close cleanly.

## Deployment

The dashboard/API is compatible with the Sites Cloudflare worker build. The Discord bot runs as a separate Node.js 22 process on a conventional host or container. Both receive secrets through their host's environment management. See `docs/DEPLOYMENT.md` for the deployment and backup procedure.
