import assert from "node:assert/strict";
import test from "node:test";
import { canManageGuild, checkModerationHierarchy, DiscordPermission, hasDiscordPermission } from "../packages/core/src/permissions";

test("Manage Guild and Administrator authorize dashboard access", () => {
  assert.equal(canManageGuild(DiscordPermission.ManageGuild), true);
  assert.equal(canManageGuild(DiscordPermission.Administrator), true);
  assert.equal(canManageGuild(0n), false);
  assert.equal(canManageGuild(0n, true), true);
});

test("Administrator satisfies specific permission checks", () => {
  assert.equal(hasDiscordPermission(DiscordPermission.Administrator, DiscordPermission.BanMembers), true);
  assert.equal(hasDiscordPermission(DiscordPermission.KickMembers, DiscordPermission.BanMembers), false);
  assert.equal(hasDiscordPermission(DiscordPermission.ManageRoles, DiscordPermission.ManageRoles), true);
});

test("moderation hierarchy blocks owners, peers, and targets above the bot", () => {
  const base = { guildOwnerId: "owner", actor: { id: "mod", highestRolePosition: 10 }, target: { id: "member", highestRolePosition: 2 }, bot: { id: "bot", highestRolePosition: 20 } };
  assert.deepEqual(checkModerationHierarchy(base), { allowed: true });
  assert.equal(checkModerationHierarchy({ ...base, target: { id: "owner", highestRolePosition: 99 } }).allowed, false);
  assert.equal(checkModerationHierarchy({ ...base, target: { id: "member", highestRolePosition: 10 } }).allowed, false);
  assert.equal(checkModerationHierarchy({ ...base, target: { id: "member", highestRolePosition: 21 } }).allowed, false);
});
