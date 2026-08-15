import type { OnyxCommand } from "./types";

let catalog: readonly OnyxCommand[] = [];

export function setCommandCatalog(commands: readonly OnyxCommand[]) {
  catalog = commands;
}

export function commandCatalog() {
  return catalog;
}
