import assert from "node:assert/strict";
import test from "node:test";
import { selectGiveawayWinners } from "../packages/core/src/giveaway";

test("winner selection is unique and excludes invalid weights", () => {
  const winners = selectGiveawayWinners([{ userId: "a", weight: 1 }, { userId: "b", weight: 1 }, { userId: "bad", weight: 0 }], 5, () => 0);
  assert.deepEqual(winners, ["a", "b"]);
});

test("weighted selection follows server-provided random points", () => {
  const winners = selectGiveawayWinners([{ userId: "one", weight: 1 }, { userId: "heavy", weight: 9 }], 1, () => 0.5);
  assert.deepEqual(winners, ["heavy"]);
});

test("winner count must be positive", () => {
  assert.throws(() => selectGiveawayWinners([], 0), RangeError);
});
