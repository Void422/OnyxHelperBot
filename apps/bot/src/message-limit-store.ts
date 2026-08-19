import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { z } from "zod";

const storedLimitSchema = z.object({
  maxMessages: z.number().int().min(1).max(100_000),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});
const stateSchema = z.object({
  version: z.literal(1),
  guilds: z.record(z.string(), z.object({
    limits: z.record(z.string(), storedLimitSchema),
    counts: z.record(z.string(), z.record(z.string(), z.number().int().nonnegative())),
  })),
});

type MessageLimitState = z.infer<typeof stateSchema>;

function emptyState(): MessageLimitState {
  return { version: 1, guilds: {} };
}

export type LocalMessageLimitClaim =
  | { active: false; allowed: true; messageCount: number; maximum: null }
  | { active: true; needsSeed: true; maximum: number }
  | { active: true; allowed: boolean; messageCount: number; maximum: number };

export class MessageLimitStore {
  private tail: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  private locked<T>(operation: () => Promise<T>): Promise<T> {
    const run = this.tail.then(operation, operation);
    this.tail = run.then(() => undefined, () => undefined);
    return run;
  }

  private async read(): Promise<MessageLimitState> {
    try {
      return stateSchema.parse(JSON.parse(await readFile(this.filePath, "utf8")));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyState();
      throw error;
    }
  }

  private async write(state: MessageLimitState) {
    await mkdir(dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(state)}\n`, { encoding: "utf8", mode: 0o600 });
    await rename(temporaryPath, this.filePath);
  }

  list(guildId: string) {
    return this.locked(async () => {
      const state = await this.read();
      return Object.entries(state.guilds[guildId]?.limits ?? {})
        .map(([channelId, limit]) => ({
          id: `local:${guildId}:${channelId}`,
          guildId,
          channelId,
          maxMessages: limit.maxMessages,
          enabled: true,
        }))
        .sort((left, right) => left.channelId.localeCompare(right.channelId));
    });
  }

  set(guildId: string, channelId: string, maxMessages: number) {
    return this.locked(async () => {
      const state = await this.read();
      const guild = state.guilds[guildId] ??= { limits: {}, counts: {} };
      if (!guild.limits[channelId] && Object.keys(guild.limits).length >= 50) throw new Error("This server already has the maximum of 50 channel message limits.");
      const now = Date.now();
      const createdAt = guild.limits[channelId]?.createdAt ?? now;
      guild.limits[channelId] = { maxMessages, createdAt, updatedAt: now };
      await this.write(state);
      return { id: `local:${guildId}:${channelId}`, guildId, channelId, maxMessages, enabled: true };
    });
  }

  remove(guildId: string, channelId: string) {
    return this.locked(async () => {
      const state = await this.read();
      const guild = state.guilds[guildId];
      if (!guild?.limits[channelId]) return false;
      delete guild.limits[channelId];
      delete guild.counts[channelId];
      if (!Object.keys(guild.limits).length && !Object.keys(guild.counts).length) delete state.guilds[guildId];
      await this.write(state);
      return true;
    });
  }

  claim(input: { guildId: string; channelId: string; userId: string; seedCount?: number }): Promise<LocalMessageLimitClaim> {
    return this.locked(async () => {
      const state = await this.read();
      const guild = state.guilds[input.guildId];
      const limit = guild?.limits[input.channelId];
      if (!guild || !limit) return { active: false, allowed: true, messageCount: 0, maximum: null };

      const channelCounts = guild.counts[input.channelId] ??= {};
      let current = channelCounts[input.userId];
      if (current === undefined && input.seedCount === undefined) return { active: true, needsSeed: true, maximum: limit.maxMessages };
      if (current === undefined) current = Math.max(0, Math.min(limit.maxMessages, Math.trunc(input.seedCount ?? 0)));

      const allowed = current < limit.maxMessages;
      const messageCount = allowed ? current + 1 : current;
      channelCounts[input.userId] = messageCount;
      await this.write(state);
      return { active: true, allowed, messageCount, maximum: limit.maxMessages };
    });
  }
}
