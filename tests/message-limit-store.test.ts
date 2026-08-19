import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { MessageLimitStore } from "../apps/bot/src/message-limit-store";

test("local message limits persist configuration and counts across instances", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "onyx-message-limits-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, "limits.json");
  const first = new MessageLimitStore(path);

  await first.set("123456789012345678", "223456789012345678", 2);
  assert.deepEqual(await first.claim({ guildId: "123456789012345678", channelId: "223456789012345678", userId: "323456789012345678" }), { active: true, needsSeed: true, maximum: 2 });
  assert.deepEqual(await first.claim({ guildId: "123456789012345678", channelId: "223456789012345678", userId: "323456789012345678", seedCount: 0 }), { active: true, allowed: true, messageCount: 1, maximum: 2 });

  const restarted = new MessageLimitStore(path);
  assert.deepEqual(await restarted.claim({ guildId: "123456789012345678", channelId: "223456789012345678", userId: "323456789012345678" }), { active: true, allowed: true, messageCount: 2, maximum: 2 });
  assert.deepEqual(await restarted.claim({ guildId: "123456789012345678", channelId: "223456789012345678", userId: "323456789012345678" }), { active: true, allowed: false, messageCount: 2, maximum: 2 });
  assert.equal((await readFile(path, "utf8")).endsWith("\n"), true);
});

test("removing a local limit also clears its saved counts", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "onyx-message-limits-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, "limits.json");
  const store = new MessageLimitStore(path);
  const input = { guildId: "123456789012345678", channelId: "223456789012345678", userId: "323456789012345678" };

  await store.set(input.guildId, input.channelId, 1);
  await store.claim({ ...input, seedCount: 0 });
  assert.equal(await store.remove(input.guildId, input.channelId), true);
  await store.set(input.guildId, input.channelId, 1);
  assert.deepEqual(await store.claim(input), { active: true, needsSeed: true, maximum: 1 });
});
