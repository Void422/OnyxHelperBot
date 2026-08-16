export interface AutomodExemptions {
  exemptRoleIds: readonly string[];
  exemptChannelIds: readonly string[];
}

export function isAutomodExempt(channelId: string, roleIds: readonly string[], exemptions: AutomodExemptions) {
  return exemptions.exemptChannelIds.includes(channelId) || roleIds.some((roleId) => exemptions.exemptRoleIds.includes(roleId));
}
