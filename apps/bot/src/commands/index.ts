import { administrationCommands } from "./administration";
import { communityCommands } from "./community";
import { informationCommands } from "./information";
import { levelCommands } from "./levels";
import { reminderCommands } from "./reminders";
import { setCommandCatalog } from "./catalog";
import { ticketCommands } from "./tickets";
import { suggestionCommands } from "./suggestions";
import { moderationCommands } from "./moderation";
import { moderationRecordCommands } from "./moderation-records";
import { utilityCommands } from "./utility";

export const commands = [...moderationCommands, ...moderationRecordCommands, ...administrationCommands, ...communityCommands, ...levelCommands, ...ticketCommands, ...suggestionCommands, ...reminderCommands, ...informationCommands, ...utilityCommands];
setCommandCatalog(commands);
export const commandMap = new Map(commands.map((command) => [command.data.name, command]));
