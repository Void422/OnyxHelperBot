import assert from "node:assert/strict";
import test from "node:test";

process.env.DISCORD_TOKEN ??= "00000000000000000000";
process.env.DISCORD_CLIENT_ID ??= "000000000000000000";
process.env.ONYX_API_URL ??= "https://example.invalid";
process.env.ONYX_SERVICE_TOKEN ??= "00000000000000000000000000000000";

type CommandOption = {
  name: string;
  type: number;
  required?: boolean;
  options?: CommandOption[];
};

function findRequiredOptionsAfterOptional(path: string, options: readonly CommandOption[], failures: string[]) {
  let sawOptionalArgument = false;

  for (const option of options) {
    if (option.type === 1 || option.type === 2) {
      findRequiredOptionsAfterOptional(`${path} ${option.name}`, option.options ?? [], failures);
      continue;
    }

    if (option.required === true && sawOptionalArgument) {
      failures.push(`/${path}: required option ${option.name} follows an optional option`);
    }
    if (option.required !== true) {
      sawOptionalArgument = true;
    }
  }
}

test("Discord command schemas place required options before optional options", async () => {
  const { commands } = await import("../apps/bot/src/commands");
  const failures: string[] = [];

  for (const command of commands) {
    const data = command.data.toJSON() as { name: string; options?: CommandOption[] };
    findRequiredOptionsAfterOptional(data.name, data.options ?? [], failures);
  }

  assert.deepEqual(failures, []);
});

test("XP adjustments require Administrator at registration and runtime", async () => {
  const [{ commands }, { PermissionFlagsBits }] = await Promise.all([import("../apps/bot/src/commands"), import("discord.js")]);
  const command = commands.find((candidate) => candidate.data.name === "xp");
  assert.ok(command);
  const data = command.data.toJSON() as { default_member_permissions?: string | null };
  assert.equal(data.default_member_permissions, PermissionFlagsBits.Administrator.toString());
  assert.deepEqual(command.userPermissions, [PermissionFlagsBits.Administrator]);
});

test("message limits require Administrator and expose set, remove, and list", async () => {
  const [{ commands }, { PermissionFlagsBits }] = await Promise.all([import("../apps/bot/src/commands"), import("discord.js")]);
  const command = commands.find((candidate) => candidate.data.name === "message-limit");
  assert.ok(command);
  const data = command.data.toJSON() as { default_member_permissions?: string | null; options?: CommandOption[] };
  assert.equal(data.default_member_permissions, PermissionFlagsBits.Administrator.toString());
  assert.deepEqual(command.userPermissions, [PermissionFlagsBits.Administrator]);
  assert.deepEqual(data.options?.map((option) => option.name), ["set", "remove", "list"]);
  const set = data.options?.find((option) => option.name === "set");
  assert.deepEqual(set?.options?.map((option) => option.name), ["channel", "maximum"]);
});
