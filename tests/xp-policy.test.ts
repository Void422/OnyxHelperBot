import assert from "node:assert/strict";
import test from "node:test";
import { XpPolicy, type XpPolicyConfig } from "../packages/core/src/xp-policy";

const config: XpPolicyConfig = { cooldownMs: 60_000, minimumLength: 8, excludedChannelIds: ["excluded"], excludedRoleIds: ["muted"], minAward: 10, maxAward: 20 };
const base = { guildId: "guild", channelId: "general", userId: "user", content: "This is a useful message with several words", roleIds: [], createdAt: 100_000 };

test("a genuine message earns bounded XP", () => {
  const decision = new XpPolicy().evaluate(base, config);
  assert.ok(decision.award >= 10 && decision.award <= 20);
});

test("cooldown and recent fingerprinting reject spam", () => {
  const policy = new XpPolicy();
  assert.ok(policy.evaluate(base, config).award > 0);
  assert.equal(policy.evaluate({ ...base, content: "A different but immediate follow-up message", createdAt: 101_000 }, config).reason, "cooldown");
  assert.equal(policy.evaluate({ ...base, createdAt: 200_000 }, config).reason, "duplicate");
});

test("excluded, tiny, and emoji-only messages receive no XP", () => {
  const policy = new XpPolicy();
  assert.equal(policy.evaluate({ ...base, channelId: "excluded" }, config).reason, "excluded");
  assert.equal(policy.evaluate({ ...base, content: "tiny" }, config).reason, "too_short");
  assert.equal(policy.evaluate({ ...base, content: "😀😀😀😀😀😀😀😀😀😀😀😀" }, config).reason, "low_signal");
});

test("zero cooldown and zero minimum length allow consecutive short messages", () => {
  const openConfig = { ...config, cooldownMs: 0, minimumLength: 0 };
  const policy = new XpPolicy();
  assert.ok(policy.evaluate({ ...base, content: "a" }, openConfig).award > 0);
  assert.ok(policy.evaluate({ ...base, content: "b" }, openConfig).award > 0);
});
