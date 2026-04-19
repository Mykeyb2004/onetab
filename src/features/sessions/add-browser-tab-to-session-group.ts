import { chromeLocalStorage } from "../../adapters/chrome/storage";
import {
  readRootState,
  writeRootState,
  type ExtensionStorageArea
} from "../../storage/local/repository";
import type { BrowserTab, TabsAdapter } from "../../types/browser";
import type { SessionGroup } from "../../types/session";
import { chromeTabsAdapter } from "../../adapters/chrome/tabs";
import { isSupportedTabUrl } from "../../domain/tabs/is-supported-tab-url";

interface AddBrowserTabToSessionGroupDependencies {
  storage: ExtensionStorageArea;
  tabs: TabsAdapter;
  now?: () => Date;
}

export interface AddBrowserTabToSessionGroupResult {
  ok: boolean;
  message: string;
  sessionId: string | null;
}

function buildNextSavedTab(
  browserTab: BrowserTab,
  sessionGroup: SessionGroup,
  now: Date
) {
  const nextOriginalIndex =
    sessionGroup.tabs.reduce((maxValue, savedTab) => Math.max(maxValue, savedTab.originalIndex), -1) + 1;
  const createdAt = now.toISOString();

  return {
    id: `tab_${sessionGroup.id}_${now.getTime()}`,
    title: browserTab.title?.trim() || browserTab.url || "Untitled Tab",
    url: browserTab.url!,
    favIconUrl: browserTab.favIconUrl ?? null,
    createdAt,
    lastOpenedAt: null,
    originalIndex: nextOriginalIndex
  };
}

export async function addBrowserTabToSessionGroup(
  sessionId: string,
  browserTab: BrowserTab | null,
  dependencies: AddBrowserTabToSessionGroupDependencies = {
    storage: chromeLocalStorage,
    tabs: chromeTabsAdapter,
    now: () => new Date()
  }
): Promise<AddBrowserTabToSessionGroupResult> {
  if (!browserTab || !isSupportedTabUrl(browserTab.url)) {
    return {
      ok: false,
      message: "The current page cannot be sent to TabVault.",
      sessionId: null
    };
  }

  const state = await readRootState(dependencies.storage);
  const now = dependencies.now?.() ?? new Date();
  let updatedSession: SessionGroup | null = null;

  const nextSessions = state.sessions.map((sessionGroup) => {
    if (sessionGroup.id !== sessionId) {
      return sessionGroup;
    }

    const nextSession: SessionGroup = {
      ...sessionGroup,
      tabs: [...sessionGroup.tabs, buildNextSavedTab(browserTab, sessionGroup, now)],
      tabCount: sessionGroup.tabCount + 1,
      updatedAt: now.toISOString()
    };

    updatedSession = nextSession;
    return nextSession;
  });

  if (!updatedSession) {
    return {
      ok: false,
      message: "Recent group not found.",
      sessionId: null
    };
  }

  const finalizedSession: SessionGroup = updatedSession;

  await writeRootState(dependencies.storage, {
    ...state,
    sessions: nextSessions
  });

  let closeFailed = false;

  try {
    await dependencies.tabs.closeTabs([browserTab.id]);
  } catch {
    closeFailed = true;
  }

  return {
    ok: !closeFailed,
    message: closeFailed
      ? `Added the current page to "${finalizedSession.title}", but failed to close the original tab.`
      : `Added the current page to "${finalizedSession.title}".`,
    sessionId: finalizedSession.id
  };
}
