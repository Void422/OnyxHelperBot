export const levelCurves = ["standard", "grind", "legendary", "custom"] as const;
export type LevelCurve = (typeof levelCurves)[number];

export const rankPermissionKeys = [
  "AddReactions",
  "EmbedLinks",
  "AttachFiles",
  "UseExternalEmojis",
  "CreatePublicThreads",
  "SendMessagesInThreads",
  "UseExternalStickers",
] as const;

export type RankPermissionKey = (typeof rankPermissionKeys)[number];

export interface RankTier {
  level: number;
  name: string;
  color: number;
  permissions: RankPermissionKey[];
  perks: string[];
  hoist?: boolean;
}

export interface RankLadderPreset {
  id: "momentum" | "grind" | "legend";
  name: string;
  curve: LevelCurve;
  summary: string;
  tiers: RankTier[];
}

const tiers = (levels: number[]): RankTier[] => [
  { level: levels[0], name: "Initiate", color: 0x6f675f, permissions: [], perks: ["First visible rank"] },
  { level: levels[1], name: "Vanguard", color: 0x3f7f8f, permissions: ["AddReactions"], perks: ["Reaction access"] },
  { level: levels[2], name: "Elite", color: 0x4f6fb0, permissions: ["AddReactions", "EmbedLinks"], perks: ["Link embeds"] },
  { level: levels[3], name: "Ascendant", color: 0x7358b5, permissions: ["AddReactions", "EmbedLinks", "AttachFiles"], perks: ["File uploads"] },
  { level: levels[4], name: "Mythic", color: 0xb24f88, permissions: ["AddReactions", "EmbedLinks", "AttachFiles", "UseExternalEmojis"], perks: ["External emoji"] },
  { level: levels[5], name: "Paragon", color: 0xd97838, permissions: ["AddReactions", "EmbedLinks", "AttachFiles", "UseExternalEmojis", "CreatePublicThreads", "SendMessagesInThreads"], perks: ["Public threads"], hoist: true },
  { level: levels[6], name: "Onyx", color: 0xe0aa4f, permissions: ["AddReactions", "EmbedLinks", "AttachFiles", "UseExternalEmojis", "CreatePublicThreads", "SendMessagesInThreads", "UseExternalStickers"], perks: ["External stickers", "Top-rank display"], hoist: true },
];

export const rankLadderPresets: RankLadderPreset[] = [
  { id: "momentum", name: "Momentum", curve: "standard", summary: "A quicker seven-rank season with a reachable finish line.", tiers: tiers([3, 8, 15, 25, 40, 60, 90]) },
  { id: "grind", name: "The Grind", curve: "grind", summary: "Long-term progression built for an active community.", tiers: tiers([5, 15, 30, 50, 75, 100, 150]) },
  { id: "legend", name: "Legend", curve: "legendary", summary: "A punishing ladder where the Onyx role is genuinely rare.", tiers: tiers([10, 25, 50, 80, 120, 175, 250]) },
];

export function getRankLadderPreset(id: RankLadderPreset["id"]) {
  return rankLadderPresets.find((preset) => preset.id === id) ?? rankLadderPresets[1];
}

export function rankForLevel(level: number, preset: RankLadderPreset = rankLadderPresets[1]) {
  const earned = [...preset.tiers].reverse().find((tier) => level >= tier.level) ?? null;
  const next = preset.tiers.find((tier) => level < tier.level) ?? null;
  return { earned, next };
}
