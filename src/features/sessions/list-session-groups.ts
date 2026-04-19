import { chromeLocalStorage } from "../../adapters/chrome/storage";
import { splitSessionGroups } from "../../domain/sessions/session-groups";
import { sortSessionGroups } from "../../domain/sessions/sort-session-groups";
import { readRootState } from "../../storage/local/repository";

export async function listSessionGroups() {
  const state = await readRootState(chromeLocalStorage);
  const { activeSessions, trashedSessions } = splitSessionGroups(state.sessions);

  return {
    activeSessions: sortSessionGroups(activeSessions),
    trashedSessions: sortSessionGroups(trashedSessions)
  };
}
