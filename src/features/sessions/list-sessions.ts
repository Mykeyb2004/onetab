import { chromeLocalStorage } from "../../adapters/chrome/storage";
import { sortSessionGroups } from "../../domain/sessions/sort-session-groups";
import { readRootState } from "../../storage/local/repository";

export async function listSessions() {
  const state = await readRootState(chromeLocalStorage);
  return sortSessionGroups(state.sessions);
}
