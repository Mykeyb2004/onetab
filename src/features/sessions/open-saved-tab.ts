import { chromeLocalStorage } from "../../adapters/chrome/storage";
import { chromeRestoreTabsAdapter } from "../../adapters/chrome/restore-tabs";
import { isSessionGroupTrashed } from "../../domain/sessions/session-groups";
import {
  readRootState,
  writeRootState,
  type ExtensionStorageArea
} from "../../storage/local/repository";
import type { RestoreTabsAdapter } from "../../types/browser";

interface OpenSavedTabDependencies {
  storage: ExtensionStorageArea;
  tabs: RestoreTabsAdapter;
  now?: () => Date;
}

export interface OpenSavedTabOptions {
  target?: "new-tab" | "current-tab";
}

export interface OpenSavedTabResult {
  ok: boolean;
  message: string;
}

export async function openSavedTab(
  sessionId: string,
  tabId: string,
  dependencies: OpenSavedTabDependencies = {
    storage: chromeLocalStorage,
    tabs: chromeRestoreTabsAdapter,
    now: () => new Date()
  },
  options: OpenSavedTabOptions = {}
): Promise<OpenSavedTabResult> {
  const state = await readRootState(dependencies.storage);
  const sessionGroup = state.sessions.find((session) => session.id === sessionId);

  if (!sessionGroup) {
    return {
      ok: false,
      message: "Session group not found."
    };
  }

  if (isSessionGroupTrashed(sessionGroup)) {
    return {
      ok: false,
      message: "Restore this group from the trash before opening its tabs."
    };
  }

  const savedTab = sessionGroup.tabs.find((tab) => tab.id === tabId);

  if (!savedTab) {
    return {
      ok: false,
      message: "Saved tab not found."
    };
  }

  const openedAt = (dependencies.now?.() ?? new Date()).toISOString();
  const nextSessions = state.sessions.map((session) =>
    session.id === sessionId
      ? {
          ...session,
          updatedAt: openedAt,
          tabs: session.tabs.map((tab) =>
            tab.id === tabId
              ? {
                  ...tab,
                  lastOpenedAt: openedAt
                }
              : tab
          )
        }
      : session
  );

  const nextState = {
    ...state,
    sessions: nextSessions
  };

  if (options.target === "current-tab") {
    await writeRootState(dependencies.storage, nextState);

    try {
      if (dependencies.tabs.replaceCurrentTab) {
        await dependencies.tabs.replaceCurrentTab(savedTab.url);
      } else {
        await dependencies.tabs.openTab(savedTab.url);
      }
    } catch (error) {
      await writeRootState(dependencies.storage, state);
      throw error;
    }
  } else {
    await dependencies.tabs.openTab(savedTab.url);
    await writeRootState(dependencies.storage, nextState);
  }

  return {
    ok: true,
    message: "Opened the saved tab and kept it in the session group."
  };
}
