import { chromeLocalStorage } from "../../adapters/chrome/storage";
import {
  readRootState,
  writeRootState,
  type ExtensionStorageArea
} from "../../storage/local/repository";

interface DeleteSessionGroupDependencies {
  storage: ExtensionStorageArea;
}

export async function deleteSessionGroup(
  sessionId: string,
  dependencies: DeleteSessionGroupDependencies = {
    storage: chromeLocalStorage
  }
): Promise<void> {
  const state = await readRootState(dependencies.storage);
  const nextSessions = state.sessions.filter((session) => session.id !== sessionId);

  if (nextSessions.length === state.sessions.length) {
    throw new Error("Session group not found.");
  }

  await writeRootState(dependencies.storage, {
    ...state,
    sessions: nextSessions
  });
}
