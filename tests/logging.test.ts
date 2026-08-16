import assert from "node:assert/strict";
import test from "node:test";
import { meaningfulRoleChanges } from "../packages/core/src/role-updates";

const baseRole = {
  name: "Member",
  color: 0x336699,
  hoist: false,
  mentionable: false,
  icon: null,
  unicodeEmoji: null,
  permissions: { bitfield: 64n },
};

test("role hierarchy-only updates do not create log changes", () => {
  const before = { ...baseRole, position: 2, rawPosition: 2 };
  const after = { ...baseRole, position: 20, rawPosition: 20 };
  assert.deepEqual(meaningfulRoleChanges(before, after), []);
});

test("meaningful role edits remain visible in the server log", () => {
  const changes = meaningfulRoleChanges(baseRole, {
    ...baseRole,
    name: "Verified",
    color: 0xe0aa4f,
    mentionable: true,
    permissions: { bitfield: 64n | 16_384n },
  });
  assert.deepEqual(changes.map((change) => change.label), ["Name", "Color", "Mentionable", "Permissions"]);
});
