# Security model

## Trust boundaries

- The browser is untrusted. Hidden buttons and client validation are convenience only.
- Discord OAuth2 identifies dashboard users. `guilds` permission data is refreshed frequently and checked on every guild operation.
- Guild IDs from URLs and request bodies never grant access by themselves.
- The Discord bot is a separate trusted service authenticated with `ONYX_SERVICE_TOKEN`.
- D1 is reachable only from the worker runtime.

## Session protection

- Session cookies are opaque, HttpOnly, SameSite=Lax, and Secure on HTTPS.
- OAuth state is random, short-lived, HttpOnly, and compared in constant time.
- Access and refresh tokens are AES-GCM encrypted with a key derived from `SESSION_SECRET` before persistence.
- State-changing browser requests require a per-session CSRF header and same-origin validation.
- Sessions expire after seven days. Discord access tokens are refreshed server-side.

## Authorization

- Manage Server or Administrator grants normal guild configuration access.
- Destructive appeal-driven unban requires Administrator in the dashboard and Ban Members on the bot.
- Bot commands check the user's Discord permission, the bot permission, module state, cooldown, and role hierarchy.
- The server owner, a peer/higher moderator target, and anyone above the bot role are protected from moderation attempts.

## Input and abuse controls

- Zod schemas bound text, arrays, Discord IDs, URLs, durations, and module settings.
- Appeal submissions are rate-limited in durable storage and protected from duplicate case submissions.
- Giveaway entries have a composite key, preventing duplicates. The trusted bot supplies live roles and account dates; the API rechecks stored XP and requirements.
- No custom command can execute code. No eval, shell, SQL console, or arbitrary regex endpoint exists.

## Secret handling

Never commit `.env`, `env.txt`, bot tokens, OAuth secrets, session secrets, service tokens, database exports, logs, or ticket transcripts. CI does not require production secrets.

If a secret is exposed:

1. Revoke or rotate it at the source.
2. Redeploy every process that uses it.
3. Invalidate OAuth sessions if `SESSION_SECRET` or stored tokens may be affected.
4. Review audit and application logs for unexpected activity.

## Reporting

Security reports should include the affected route or command, the guild boundary involved, reproduction steps, and impact. Never include live tokens or private member data in an issue.
