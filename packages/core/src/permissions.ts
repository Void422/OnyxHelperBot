export const DiscordPermission = {
  KickMembers: 1n << 1n,
  BanMembers: 1n << 2n,
  Administrator: 1n << 3n,
  ManageChannels: 1n << 4n,
  ManageGuild: 1n << 5n,
  ManageMessages: 1n << 13n,
  ManageRoles: 1n << 28n,
  ModerateMembers: 1n << 40n,
} as const;

export function hasDiscordPermission(raw: string | bigint, permission: bigint): boolean {
  const permissions = typeof raw === "bigint" ? raw : BigInt(raw);
  return (permissions & DiscordPermission.Administrator) !== 0n || (permissions & permission) !== 0n;
}

export function canManageGuild(raw: string | bigint, owner = false): boolean {
  return owner || hasDiscordPermission(raw, DiscordPermission.ManageGuild);
}

export interface HierarchySubject {
  id: string;
  highestRolePosition: number;
  isGuildOwner?: boolean;
}

export function checkModerationHierarchy(input: {
  guildOwnerId: string;
  actor: HierarchySubject;
  target: HierarchySubject;
  bot: HierarchySubject;
}): { allowed: true } | { allowed: false; reason: string } {
  if (input.target.id === input.guildOwnerId || input.target.isGuildOwner) {
    return { allowed: false, reason: "The server owner cannot be moderated." };
  }
  if (input.actor.id === input.target.id) {
    return { allowed: false, reason: "You cannot use this action on yourself." };
  }
  if (input.actor.id !== input.guildOwnerId && input.actor.highestRolePosition <= input.target.highestRolePosition) {
    return { allowed: false, reason: "Your highest role must be above this member's highest role." };
  }
  if (input.bot.highestRolePosition <= input.target.highestRolePosition) {
    return { allowed: false, reason: "Move the Onyx role above this member's highest role before trying again." };
  }
  return { allowed: true };
}
