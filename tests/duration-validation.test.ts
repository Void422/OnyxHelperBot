import assert from "node:assert/strict";
import test from "node:test";
import { formatDuration, parseDuration } from "../packages/core/src/duration";
import { settingsUpdateSchema } from "../packages/core/src/validation";

test("Discord-style durations parse within configured bounds", () => {
  assert.equal(parseDuration("12h"), 43_200_000);
  assert.equal(formatDuration(43_200_000), "12 hours");
  assert.equal(parseDuration("29d"), null);
  assert.equal(parseDuration("forever"), null);
});

test("settings validation rejects inverted XP ranges", () => {
  const result = settingsUpdateSchema.safeParse({ enabledModules: ["levels"], staffRoleIds: [], locale: "en-US", timezone: "UTC", settings: { xp: { minAward: 20, maxAward: 10 } } });
  assert.equal(result.success, false);
});
