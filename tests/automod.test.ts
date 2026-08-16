import assert from "node:assert/strict";
import test from "node:test";
import { isAutomodExempt } from "../packages/core/src/automod";

test("automod exemptions only match explicitly selected roles or channels", () => {
  const exemptions = { exemptRoleIds: ["ignored-role"], exemptChannelIds: ["ignored-channel"] };
  assert.equal(isAutomodExempt("general", ["administrator", "staff"], exemptions), false);
  assert.equal(isAutomodExempt("general", ["ignored-role"], exemptions), true);
  assert.equal(isAutomodExempt("ignored-channel", [], exemptions), true);
});
