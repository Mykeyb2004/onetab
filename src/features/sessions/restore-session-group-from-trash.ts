import { chromeLocalStorage } from "../../adapters/chrome/storage";
import {
  readRootState,
  writeRootState,
  type ExtensionStorageArea
} from "../../storage/local/repository";
import type { SessionGroup } from "../../types/session";

interface RestoreSessionGroupFromTrashDependencies {
  storage: ExtensionStorageArea;
  now?: () => Date;
}

export async function restoreSessionGroupFromTrash(
  sessionId: string,
  dependencies: RestoreSessionGroupFromTrashDependencies = {
    storage: chromeLocalStorage,
    now: () => new Date()
  }
): Promise<SessionGroup> {
  const state = await readRootState(dependencies.storage);
  const restoredAt = (dependencies.now?.() ?? new Date()).toISOString();
  let restoredSession: SessionGroup | null = null;

  const nextSessions = state.sessions.map((session) => {
    if (session.id !== sessionId) {
      return session;
    }

    restoredSession = {
      ...session,
      trashedAt: null,
      updatedAt: restoredAt
    };

    return restoredSession;
  });

  if (!restoredSession) {
    throw new Error("Session group not found.");
  }

  await writeRootState(dependencies.storage, {
    ...state,
    sessions: nextSessions
  });

  return restoredSession;
}
