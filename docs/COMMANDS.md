# Command catalog

Onyx currently registers 51 top-level slash commands containing 78 independently configurable command actions. The dashboard Command Center is generated from the same catalog the bot uses for enable/disable and cooldown overrides, so it does not advertise placeholder commands.

## Moderation

`/ban`, `/unban`, `/softban`, `/kick`, `/timeout`, `/untimeout`, `/mute`, `/unmute`, `/warn`, `/warnings`, `/delwarn`, `/clearwarns`, `/history`, `/case`, `/reason`, `/modnote`, `/notes`, `/removenote`, `/purge`, `/lock`, `/unlock`, `/slowmode`, `/nick`, `/resetnick`

These actions create durable cases or records where appropriate. Discord permissions and actor/target/bot role hierarchy are checked at execution time. Configured moderation log routes receive case events.

## Administration

`/role add`, `/role remove`, `/role members`, `/announce`, `/say`, `/topic`, `/thread`

Role actions enforce manageability and hierarchy. Onyx disables mentions in relayed plain messages unless the command explicitly owns the mention behavior.

## Giveaways

`/giveaway create`, `/giveaway list`, `/giveaway info`, `/giveaway end`, `/giveaway reroll`, `/giveaway pause`, `/giveaway resume`, `/giveaway edit`

Entries, requirements, remaining time, and winners are stored server-side. Scheduled endings survive bot restarts, and winner messages can be customized in Message Studio.

## Levels

`/rank`, `/leaderboard`, `/levelroles list`, `/levelroles setup`, `/xp get`, `/xp add`, `/xp remove`, `/xp set`

XP uses anti-spam policy, channel/role exclusions, persistent profiles, level rewards, and audited staff adjustments.

## Tickets

`/ticket panel`, `/ticket info`, `/ticket claim`, `/ticket close`, `/ticket reopen`, `/ticket add`, `/ticket remove`, `/ticket rename`, `/ticket transcript`

Members open tickets from the configured panel button. Ticket records, claims, participants, and status survive restarts; transcripts export the latest 100 messages on demand.

## Community

`/suggest`, `/suggestion list`, `/suggestion approve`, `/suggestion deny`, `/suggestion implement`, `/suggestion duplicate`

Suggestions support public voting, optional discussion threads, anonymous display, and staff decisions. Starboard promotion is reaction-driven rather than a slash command.

## Utilities and information

`/remind create`, `/remind list`, `/remind delete`, `/ping`, `/uptime`, `/avatar`, `/banner`, `/help`, `/userinfo`, `/serverinfo`, `/roleinfo`, `/channelinfo`, `/membercount`, `/emojis`, `/stickers`, `/botinfo`

Reminders use durable due jobs and can deliver in-channel or by direct message. `/help` is built from the live command registry and automatically follows new command deployments.

## Runtime policy

- A disabled module blocks all of its commands and event handlers.
- A disabled command action blocks only that exact command or subcommand.
- Per-action cooldowns are configurable from 0 to 3,600 seconds.
- Discord default member permissions control command visibility; runtime permission and hierarchy checks remain authoritative.
- Unexpected failures return a short reference while structured logs retain the diagnostic context.
