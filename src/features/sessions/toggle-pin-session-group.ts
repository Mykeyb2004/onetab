import { chromeLocalStorage } from "../../adapters/chrome/storage";
import {
  readRootState,
  writeRootState,
  type ExtensionStorageArea
} from "../../storage/local/repository";
import type { SessionGroup } from "../../types/session";

interface TogglePinSessionGroupDependencies {
  storage: ExtensionStorageArea;
  now?: () => Date;
}

export async function togglePinSessionGroup(
  sessionId: string,
  dependencies: TogglePinSessionGroupDependencies = {
    storage: chromeLocalStorage,
    now: () => new Date()
  }
): Promise<SessionGroup> {
  const state = await readRootState(dependencies.storage);
  const updatedAt = (dependencies.now?.() ?? new Date()).toISOString();
  let toggledSession: SessionGroup | null = null;

  const nextSessions = state.sessions.map((session) => {
    if (session.id !== sessionId) {
      return session;
    }

    toggledSession = {
      ...session,
      pinned: !session.pinned,
      updatedAt
    };

    return toggledSession;
  });

  if (!toggledSession) {
    throw new Error("Session group not found.");
  }

  await writeRootState(dependencies.storage, {
    ...state,
    sessions: nextSessions
  });

  return toggledSession;
}
