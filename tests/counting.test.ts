import assert from "node:assert/strict";
import test from "node:test";
import { countingAwardForNumber, countingLevelCurve, normalizeCountingEmoji, parseCountingNumber } from "../packages/core/src/counting";
import { xpForLevel } from "../packages/core/src/leveling";

test("counting numbers accept readable integers and reject expressions", () => {
  assert.equal(parseCountingNumber("92"), 92);
  assert.equal(parseCountingNumber("1,000"), 1_000);
  assert.equal(parseCountingNumber("10_000"), 10_000);
  assert.equal(parseCountingNumber("2 + 2"), null);
  assert.equal(parseCountingNumber("09"), null);
  assert.equal(parseCountingNumber("3.5"), null);
  assert.equal(parseCountingNumber("hello 92"), null);
});

test("counting rewards grow at configured channel milestones", () => {
  const settings = { baseAward: 5, bonusEvery: 100, bonusAward: 5, maximumAward: 0 };
  assert.equal(countingAwardForNumber(1, settings), 5);
  assert.equal(countingAwardForNumber(99, settings), 5);
  assert.equal(countingAwardForNumber(100, settings), 10);
  assert.equal(countingAwardForNumber(500, settings), 30);
  assert.equal(countingAwardForNumber(500, { ...settings, maximumAward: 20 }), 20);
});

test("counting rewards remain safe for huge numbers and damaged stored intervals", () => {
  assert.equal(countingAwardForNumber(Number.MAX_SAFE_INTEGER, { baseAward: 1_000_000, bonusEvery: 1, bonusAward: 1_000_000, maximumAward: 0 }), 2_000_000_000);
  assert.equal(countingAwardForNumber(100, { baseAward: 5, bonusEvery: 0, bonusAward: 5, maximumAward: 0 }), 10);
});

test("counting levels use their own curve", () => {
  const curve = countingLevelCurve({ levelBaseXp: 50, levelGrowthXp: 25, levelGrowthPercent: 10 });
  assert.equal(xpForLevel(1, curve), 50);
  assert.equal(xpForLevel(2, curve) - xpForLevel(1, curve), 80);
});

test("custom counting emoji markup is normalized to its Discord ID", () => {
  assert.equal(normalizeCountingEmoji("<:Tick:1268166795328487496>"), "1268166795328487496");
  assert.equal(normalizeCountingEmoji("✅"), "✅");
});
