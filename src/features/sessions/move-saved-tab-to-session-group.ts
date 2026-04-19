import { chromeLocalStorage } from "../../adapters/chrome/storage";
import { isSessionGroupTrashed } from "../../domain/sessions/session-groups";
import {
  readRootState,
  writeRootState,
  type ExtensionStorageArea
} from "../../storage/local/repository";
import type { SavedTab } from "../../types/session";

interface MoveSavedTabToSessionGroupDependencies {
  storage: ExtensionStorageArea;
  now?: () => Date;
}

export interface MoveSavedTabToSessionGroupResult {
  ok: boolean;
  message: string;
}

function reindexTabs(savedTabs: SavedTab[]): SavedTab[] {
  return savedTabs.map((savedTab, index) => ({
    ...savedTab,
    originalIndex: index
  }));
}

export async function moveSavedTabToSessionGroup(
  sourceSessionId: string,
  tabId: string,
  targetSessionId: string,
  dependencies: MoveSavedTabToSessionGroupDependencies = {
    storage: chromeLocalStorage,
    now: () => new Date()
  }
): Promise<MoveSavedTabToSessionGroupResult> {
  if (sourceSessionId === targetSessionId) {
    return {
      ok: true,
      message: "The tab is already in this session group."
    };
  }

  const state = await readRootState(dependencies.storage);
  const sourceSession = state.sessions.find((sessionGroup) => sessionGroup.id === sourceSessionId);
  const targetSession = state.sessions.find((sessionGroup) => sessionGroup.id === targetSessionId);

  if (!sourceSession || !targetSession) {
    return {
      ok: false,
      message: "Source or target session group not found."
    };
  }

  if (isSessionGroupTrashed(sourceSession) || isSessionGroupTrashed(targetSession)) {
    return {
      ok: false,
      message: "Tabs can only be moved between active session groups."
    };
  }

  const movedTab = sourceSession.tabs.find((savedTab) => savedTab.id === tabId);

  if (!movedTab) {
    return {
      ok: false,
      message: "Saved tab not found."
    };
  }

  const movedAt = (dependencies.now?.() ?? new Date()).toISOString();
  const nextSessions = state.sessions.map((sessionGroup) => {
    if (sessionGroup.id === sourceSessionId) {
      const remainingTabs = reindexTabs(sessionGroup.tabs.filter((savedTab) => savedTab.id !== tabId));

      return {
        ...sessionGroup,
        tabs: remainingTabs,
        tabCount: remainingTabs.length,
        updatedAt: movedAt
      };
    }

    if (sessionGroup.id === targetSessionId) {
      const nextTabs = reindexTabs([...sessionGroup.tabs, movedTab]);

      return {
        ...sessionGroup,
        tabs: nextTabs,
        tabCount: nextTabs.length,
        updatedAt: movedAt
      };
    }

    return sessionGroup;
  });

  await writeRootState(dependencies.storage, {
    ...state,
    sessions: nextSessions
  });

  return {
    ok: true,
    message: `Moved "${movedTab.title}" into "${targetSession.title}".`
  };
}
