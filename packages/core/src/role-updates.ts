export interface RoleUpdateSnapshot {
  name: string;
  color: number;
  hoist: boolean;
  mentionable: boolean;
  icon: string | null;
  unicodeEmoji: string | null;
  permissions: { bitfield: bigint };
}

export interface RoleUpdateChange {
  label: string;
  before: string;
  after: string;
}

function roleColor(color: number) {
  return color ? `#${color.toString(16).padStart(6, "0").toUpperCase()}` : "Default";
}

function yesNo(value: boolean) {
  return value ? "Yes" : "No";
}

export function meaningfulRoleChanges(before: RoleUpdateSnapshot, after: RoleUpdateSnapshot): RoleUpdateChange[] {
  const changes: RoleUpdateChange[] = [];
  if (before.name !== after.name) changes.push({ label: "Name", before: before.name, after: after.name });
  if (before.color !== after.color) changes.push({ label: "Color", before: roleColor(before.color), after: roleColor(after.color) });
  if (before.hoist !== after.hoist) changes.push({ label: "Displayed separately", before: yesNo(before.hoist), after: yesNo(after.hoist) });
  if (before.mentionable !== after.mentionable) changes.push({ label: "Mentionable", before: yesNo(before.mentionable), after: yesNo(after.mentionable) });
  if (before.icon !== after.icon || before.unicodeEmoji !== after.unicodeEmoji) changes.push({ label: "Icon", before: before.icon ?? before.unicodeEmoji ?? "None", after: after.icon ?? after.unicodeEmoji ?? "None" });
  if (before.permissions.bitfield !== after.permissions.bitfield) changes.push({ label: "Permissions", before: "Previous set", after: "Updated set" });
  return changes;
}
