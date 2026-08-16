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

test("grind curves preserve thresholds while demanding more XP", () => {
  for (const curve of ["grind", "legendary"] as const) {
    for (let level = 1; level < 100; level += 1) {
      assert.ok(xpForLevel(level, curve) > xpForLevel(level));
      assert.equal(levelFromXp(xpForLevel(level, curve), curve), level);
    }
  }
});

test("custom curves control the first level and exact per-level growth", () => {
  const curve = { curve: "custom", baseXp: 75, growthXp: 40 } as const;
  assert.equal(xpForLevel(1, curve), 75);
  assert.equal(xpForLevel(2, curve) - xpForLevel(1, curve), 115);
  assert.equal(xpForLevel(25, curve) - xpForLevel(24, curve), 1_035);
  assert.equal(levelFromXp(xpForLevel(25, curve), curve), 25);
});

test("preset curves ignore stored custom tuning", () => {
  assert.equal(xpForLevel(10, { curve: "grind", baseXp: 1, growthXp: 0 }), xpForLevel(10, "grind"));
});
