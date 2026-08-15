import assert from "node:assert/strict";
import test from "node:test";
import { rankForLevel, rankLadderPresets } from "../packages/core/src/rank-ladders";

test("rank ladders have seven ordered, distinct tiers", () => {
  for (const preset of rankLadderPresets) {
    assert.equal(preset.tiers.length, 7);
    assert.equal(new Set(preset.tiers.map((tier) => tier.name)).size, 7);
    for (let index = 1; index < preset.tiers.length; index += 1) {
      assert.ok(preset.tiers[index].level > preset.tiers[index - 1].level);
      assert.ok(preset.tiers[index].permissions.length >= preset.tiers[index - 1].permissions.length);
    }
  }
});

test("rank lookup returns the earned and next tier", () => {
  const preset = rankLadderPresets[1];
  assert.equal(rankForLevel(31, preset).earned?.name, "Elite");
  assert.equal(rankForLevel(31, preset).next?.name, "Ascendant");
});
