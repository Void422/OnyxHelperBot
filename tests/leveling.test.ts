import assert from "node:assert/strict";
import test from "node:test";
import { levelFromXp, levelProgress, xpForLevel } from "../packages/core/src/leveling";

test("level thresholds are monotonic and reversible", () => {
  for (let level = 0; level < 100; level += 1) {
    assert.ok(xpForLevel(level + 1) > xpForLevel(level));
    assert.equal(levelFromXp(xpForLevel(level)), level);
    assert.equal(levelFromXp(xpForLevel(level + 1) - 1), level);
  }
});

test("progress reports the correct current-level interval", () => {
  const floor = xpForLevel(7);
  const next = xpForLevel(8);
  const progress = levelProgress(Math.floor((floor + next) / 2));
  assert.equal(progress.level, 7);
  assert.ok(progress.percent >= 49 && progress.percent <= 50);
});
