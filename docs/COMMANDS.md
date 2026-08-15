# Command catalog

Descriptions are the same natural-language summaries users see in Discord.

## Moderation

| Command | Description | User permission | Module |
|---|---|---|---|
| `/ban` | Remove a member from the server, permanently or for a set time. | Ban Members | Moderation |
| `/unban` | Lift a member's ban using their Discord user ID. | Ban Members | Moderation |
| `/kick` | Remove a member without preventing them from coming back. | Kick Members | Moderation |
| `/warn` | Add a persistent warning to a member's moderation history. | Moderate Members | Moderation |
| `/warnings` | Review a member's active warnings. | Moderate Members | Moderation |
| `/timeout` | Pause a member's ability to participate for up to 28 days. | Moderate Members | Moderation |
| `/untimeout` | Let a timed-out member participate again. | Moderate Members | Moderation |
| `/purge` | Remove a batch of recent messages from this channel. | Manage Messages | Moderation |
| `/lock` | Pause member messages in this channel. | Manage Channels | Moderation |
| `/unlock` | Restore member messages in this channel. | Manage Channels | Moderation |
| `/slowmode` | Set how often members can send messages in this channel. | Manage Channels | Moderation |

## Community and levels

| Command | Description | User permission | Module |
|---|---|---|---|
| `/giveaway create` | Start a durable giveaway in a chosen channel. | Manage Server | Giveaways |
| `/rank` | See a member's level, XP progress, and server rank. | Everyone | Levels |

## Utilities and information

| Command | Description | User permission | Module |
|---|---|---|---|
| `/help` | Browse Onyx commands by category. | Everyone | Core |
| `/ping` | Check whether Onyx is online and responding normally. | Everyone | Core |
| `/uptime` | See how long this Onyx process has been running. | Everyone | Core |
| `/avatar` | Open a member's Discord avatar at full size. | Everyone | Core |
| `/userinfo` | View useful account and server details for a member. | Everyone | Core |
| `/serverinfo` | See a concise overview of this Discord server. | Everyone | Core |

Disabled module commands return a clear message and do not perform work. Discord default member permissions keep staff commands out of most command pickers, and runtime checks remain authoritative.
