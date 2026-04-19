import { chromeLocalStorage } from "../../adapters/chrome/storage";
import {
  readRootState,
  writeRootState,
  type ExtensionStorageArea
} from "../../storage/local/repository";
import type { SessionGroup } from "../../types/session";

interface RenameSessionGroupDependencies {
  storage: ExtensionStorageArea;
  now?: () => Date;
}

export async function renameSessionGroup(
  sessionId: string,
  title: string,
  dependencies: RenameSessionGroupDependencies = {
    storage: chromeLocalStorage,
    now: () => new Date()
  }
): Promise<SessionGroup> {
  const nextTitle = title.trim();

  if (!nextTitle) {
    throw new Error("Session group title cannot be empty.");
  }

  const state = await readRootState(dependencies.storage);
  const updatedAt = (dependencies.now?.() ?? new Date()).toISOString();
  let renamedSession: SessionGroup | null = null;

  const nextSessions = state.sessions.map((session) => {
    if (session.id !== sessionId) {
      return session;
    }

    renamedSession = {
      ...session,
      title: nextTitle,
      updatedAt
    };

    return renamedSession;
  });

  if (!renamedSession) {
    throw new Error("Session group not found.");
  }

  await writeRootState(dependencies.storage, {
    ...state,
    sessions: nextSessions
  });

  return renamedSession;
}
