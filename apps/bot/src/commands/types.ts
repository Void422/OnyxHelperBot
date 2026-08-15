import type { ChatInputCommandInteraction, PermissionResolvable, SlashCommandBuilder } from "discord.js";
import type { GuildModule } from "@/packages/core/src/domain";
import type { OnyxApiClient } from "../api-client";

export interface CommandContext {
  interaction: ChatInputCommandInteraction<"cached">;
  api: OnyxApiClient;
}

export interface OnyxCommand {
  data: Pick<SlashCommandBuilder, "name" | "toJSON">;
  category: "Moderation" | "Community" | "Levels" | "Utilities" | "Information";
  module?: GuildModule;
  userPermissions?: PermissionResolvable[];
  botPermissions?: PermissionResolvable[];
  cooldownSeconds?: number;
  execute(context: CommandContext): Promise<void>;
}
