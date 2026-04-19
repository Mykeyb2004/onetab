import { chromeLocalStorage } from "../../adapters/chrome/storage";
import { splitSessionGroups } from "../../domain/sessions/session-groups";
import {
  readRootState,
  writeRootState,
  type ExtensionStorageArea
} from "../../storage/local/repository";

interface EmptyTrashDependencies {
  storage: ExtensionStorageArea;
}

export async function emptyTrash(
  dependencies: EmptyTrashDependencies = {
    storage: chromeLocalStorage
  }
): Promise<number> {
  const state = await readRootState(dependencies.storage);
  const { activeSessions, trashedSessions } = splitSessionGroups(state.sessions);

  await writeRootState(dependencies.storage, {
    ...state,
    sessions: activeSessions
  });

  return trashedSessions.length;
}
