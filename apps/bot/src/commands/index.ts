import { communityCommands } from "./community";
import { moderationCommands } from "./moderation";
import { utilityCommands } from "./utility";

export const commands = [...moderationCommands, ...communityCommands, ...utilityCommands];
export const commandMap = new Map(commands.map((command) => [command.data.name, command]));
