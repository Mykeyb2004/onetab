import { chromeLocalStorage } from "../../../adapters/chrome/storage";
import { chromeRestoreTabsAdapter } from "../../../adapters/chrome/restore-tabs";
import {
  readRootState,
  writeRootState,
  type ExtensionStorageArea
} from "../../../storage/local/repository";
import type { RestoreTabsAdapter } from "../../../types/browser";

export interface RestoreSavedTabDependencies {
  storage: ExtensionStorageArea;
  tabs: RestoreTabsAdapter;
  now?: () => Date;
}

export interface RestoreSavedTabResult {
  ok: boolean;
  message: string;
  removedGroup: boolean;
  remainingTabCount: number;
}

export async function restoreSavedTab(
  sessionId: string,
  tabId: string,
  dependencies: RestoreSavedTabDependencies = {
    storage: chromeLocalStorage,
    tabs: chromeRestoreTabsAdapter,
    now: () => new Date()
  }
): Promise<RestoreSavedTabResult> {
  const state = await readRootState(dependencies.storage);
  const sessionGroup = state.sessions.find((session) => session.id === sessionId);

  if (!sessionGroup) {
    return {
      ok: false,
      message: "Session group not found.",
      removedGroup: false,
      remainingTabCount: 0
    };
  }

  const savedTab = sessionGroup.tabs.find((tab) => tab.id === tabId);

  if (!savedTab) {
    return {
      ok: false,
      message: "Saved tab not found.",
      removedGroup: false,
      remainingTabCount: sessionGroup.tabs.length
    };
  }

  await dependencies.tabs.openTab(savedTab.url);

  const restoredAt = (dependencies.now?.() ?? new Date()).toISOString();
  const remainingTabs = sessionGroup.tabs.filter((tab) => tab.id !== tabId);
  const nextSessions =
    remainingTabs.length === 0
      ? state.sessions.filter((session) => session.id !== sessionId)
      : state.sessions.map((session) =>
          session.id === sessionId
            ? {
                ...session,
                updatedAt: restoredAt,
                tabs: remainingTabs,
                tabCount: remainingTabs.length
              }
            : session
        );

  await writeRootState(dependencies.storage, {
    ...state,
    sessions: nextSessions
  });

  return {
    ok: true,
    message:
      remainingTabs.length === 0
        ? "Restored the last tab and removed the empty session group."
        : `Restored 1 tab. ${remainingTabs.length} tab(s) remain in the session group.`,
    removedGroup: remainingTabs.length === 0,
    remainingTabCount: remainingTabs.length
  };
}
