import { chromeLocalStorage } from "../../adapters/chrome/storage";
import { readRootState } from "../../storage/local/repository";

export async function loadSettings() {
  const state = await readRootState(chromeLocalStorage);
  return state.settings;
}
