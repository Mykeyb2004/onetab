import type { ExtensionSettings } from "../../types/settings";
import { chromeLocalStorage } from "../../adapters/chrome/storage";
import { updateSettings } from "../../storage/local/repository";

export async function saveSettings(patch: Partial<ExtensionSettings>) {
  const state = await updateSettings(chromeLocalStorage, patch);
  return state.settings;
}
