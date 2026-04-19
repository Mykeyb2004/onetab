import { sortSavedTabsByOriginalIndex } from "../../../domain/sessions/sort-saved-tabs";
import { chromeLocalStorage } from "../../../adapters/chrome/storage";
import { chromeRestoreTabsAdapter } from "../../../adapters/chrome/restore-tabs";
import {
  readRootState,
  writeRootState,
  type ExtensionStorageArea
} from "../../../storage/local/repository";
import type { RestoreTabsAdapter } from "../../../types/browser";

export interface RestoreSessionGroupDependencies {
  storage: ExtensionStorageArea;
  tabs: RestoreTabsAdapter;
  now?: () => Date;
}

export interface RestoreSessionGroupResult {
  ok: boolean;
  message: string;
  restoredCount: number;
  windowId: number | null;
}

export async function restoreSessionGroup(
  sessionId: string,
  dependencies: RestoreSessionGroupDependencies = {
    storage: chromeLocalStorage,
    tabs: chromeRestoreTabsAdapter,
    now: () => new Date()
  }
): Promise<RestoreSessionGroupResult> {
  const state = await readRootState(dependencies.storage);
  const sessionGroup = state.sessions.find((session) => session.id === sessionId);

  if (!sessionGroup) {
    return {
      ok: false,
      message: "Session group not found.",
      restoredCount: 0,
      windowId: null
    };
  }

  const orderedTabs = sortSavedTabsByOriginalIndex(sessionGroup.tabs);
  const restoredAt = (dependencies.now?.() ?? new Date()).toISOString();
  const windowId = await dependencies.tabs.openTabsInNewWindow(
    orderedTabs.map((savedTab) => savedTab.url)
  );

  const nextSessions =
    state.settings.restoreBehavior === "remove-group"
      ? state.sessions.filter((session) => session.id !== sessionId)
      : state.sessions.map((session) =>
          session.id === sessionId
            ? {
                ...session,
                updatedAt: restoredAt,
                tabs: session.tabs.map((savedTab) => ({
                  ...savedTab,
                  lastOpenedAt: restoredAt
                }))
              }
            : session
        );

  await writeRootState(dependencies.storage, {
    ...state,
    sessions: nextSessions
  });

  return {
    ok: true,
    message: `Restored ${orderedTabs.length} tab(s) in a new window.`,
    restoredCount: orderedTabs.length,
    windowId
  };
}
