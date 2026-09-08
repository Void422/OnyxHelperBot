import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { CountingStore } from "../apps/bot/src/counting-store";

const guildId = "123456789012345678";
const channelId = "223456789012345678";
const validatorBotId = "323456789012345678";
const actorUserId = "423456789012345678";

async function createStore(context: test.TestContext) {
  const directory = await mkdtemp(join(tmpdir(), "onyx-counting-"));
  const store = new CountingStore(join(directory, "counting.sqlite"));
  context.after(async () => {
    store.close();
    await rm(directory, { recursive: true, force: true });
  });
  store.configure({ action: "setup", guildId, actorUserId, channelId, validatorBotId, acceptedEmoji: "Tick" });
  return store;
}

test("hosted counting progress persists and one message can award only once", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "onyx-counting-restart-"));
  const databasePath = join(directory, "counting.sqlite");
  const firstStore = new CountingStore(databasePath);
  firstStore.configure({ action: "setup", guildId, actorUserId, channelId, validatorBotId, acceptedEmoji: "Tick" });
  firstStore.configure({ action: "rewards", guildId, actorUserId, baseAward: 5, bonusEvery: 100, bonusAward: 5, maximumAward: 0 });
  const input = { guildId, channelId, userId: actorUserId, messageId: "523456789012345678", countNumber: 100, occurredAt: new Date("2026-09-08T00:00:00Z") };

  const first = firstStore.award(input);
  firstStore.close();
  const restarted = new CountingStore(databasePath);
  context.after(async () => {
    restarted.close();
    await rm(directory, { recursive: true, force: true });
  });
  const duplicate = restarted.award(input);

  assert.equal(first.awarded, true);
  assert.equal(first.xpAward, 10);
  assert.equal(duplicate.awarded, false);
  assert.equal(duplicate.xpAward, 0);
  assert.deepEqual(restarted.getProfile(guildId, actorUserId).profile, { xp: 10, acceptedCounts: 1, highestNumber: 100, lastCountAt: "2026-09-08T00:00:00.000Z", rank: 1 });
});

test("hosted counting leaderboard, ranks, and reset remain separate", async (context) => {
  const store = await createStore(context);
  const secondUserId = "623456789012345678";
  store.award({ guildId, channelId, userId: actorUserId, messageId: "723456789012345678", countNumber: 1, occurredAt: new Date("2026-09-08T00:00:00Z") });
  store.award({ guildId, channelId, userId: secondUserId, messageId: "823456789012345678", countNumber: 500, occurredAt: new Date("2026-09-08T00:01:00Z") });

  assert.deepEqual(store.leaderboard(guildId).map(({ userId, xp, rank }) => ({ userId, xp, rank })), [
    { userId: secondUserId, xp: 30, rank: 1 },
    { userId: actorUserId, xp: 5, rank: 2 },
  ]);
  assert.equal(store.getProfile(guildId, actorUserId).profile.rank, 2);
  assert.deepEqual(store.reset(guildId), { resetProfiles: 2, resetEntries: 2 });
  assert.equal(store.getSettings(guildId)?.enabled, true);
  assert.equal(store.leaderboard(guildId).length, 0);
});
