import { chromeLocalStorage } from "../../adapters/chrome/storage";
import { readRootState } from "../../storage/local/repository";
import type { ExtensionSettings } from "../../types/settings";
import {
  loadPersistenceDirectoryState,
  type PersistenceDirectoryState
} from "./persistence-directory";

export interface SettingsPageState {
  settings: ExtensionSettings | null;
  settingsError: string | null;
  persistence: PersistenceDirectoryState;
}

export async function loadSettingsPageState(): Promise<SettingsPageState> {
  const persistence = await loadPersistenceDirectoryState();
  let settings: ExtensionSettings | null = null;
  let settingsError: string | null = null;

  try {
    const state = await readRootState(chromeLocalStorage);
    settings = state.settings;
  } catch (error: unknown) {
    settingsError =
      error instanceof Error ? error.message : "Failed to load settings from the active data store.";
  }

  return {
    settings,
    settingsError,
    persistence
  };
}
