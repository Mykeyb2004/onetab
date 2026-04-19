import { chromeLocalStorage } from "../../adapters/chrome/storage";
import {
  readRootState,
  writeRootState,
  type ExtensionStorageArea
} from "../../storage/local/repository";
import type { SessionGroup } from "../../types/session";

interface DeleteSavedTabDependencies {
  storage: ExtensionStorageArea;
  now?: () => Date;
}

export async function deleteSavedTab(
  sessionId: string,
  tabId: string,
  dependencies: DeleteSavedTabDependencies = {
    storage: chromeLocalStorage,
    now: () => new Date()
  }
): Promise<SessionGroup | null> {
  const state = await readRootState(dependencies.storage);
  const targetSession = state.sessions.find((session) => session.id === sessionId);

  if (!targetSession) {
    throw new Error("Session group not found.");
  }

  const remainingTabs = targetSession.tabs.filter((savedTab) => savedTab.id !== tabId);

  if (remainingTabs.length === targetSession.tabs.length) {
    throw new Error("Saved tab not found.");
  }

  const updatedAt = (dependencies.now?.() ?? new Date()).toISOString();
  let updatedSession: SessionGroup | null = null;

  const nextSessions =
    remainingTabs.length === 0
      ? state.sessions.filter((session) => session.id !== sessionId)
      : state.sessions.map((session) => {
          if (session.id !== sessionId) {
            return session;
          }

          updatedSession = {
            ...session,
            tabs: remainingTabs,
            tabCount: remainingTabs.length,
            updatedAt
          };

          return updatedSession;
        });

  await writeRootState(dependencies.storage, {
    ...state,
    sessions: nextSessions
  });

  return updatedSession;
}
