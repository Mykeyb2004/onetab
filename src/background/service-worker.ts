import { chromeNotificationsAdapter } from "../adapters/chrome/notifications";
import { chromeTabsAdapter, toBrowserTab } from "../adapters/chrome/tabs";
import { chromeLocalStorage } from "../adapters/chrome/storage";
import { executeCaptureRuntimeAction } from "./execute-capture-runtime-action";
import { captureBrowserTab } from "../features/sessions/capture/capture-browser-tab";
import { captureBrowserTabs } from "../features/sessions/capture/capture-tabs";
import { captureCurrentTab } from "../features/sessions/capture/capture-current-tab";
import { captureCurrentWindow } from "../features/sessions/capture/capture-current-window";
import { captureSelectedTabs } from "../features/sessions/capture/capture-selected-tabs";
import { addBrowserTabToSessionGroup } from "../features/sessions/add-browser-tab-to-session-group";
import {
  getBrowserTabsExcludingCurrentSite,
  getBrowserTabsExceptCurrent,
  getBrowserTabsInSameGroup,
  getBrowserTabsToTheLeft,
  getBrowserTabsToTheRight,
  getHighlightedBrowserTabs
} from "../domain/tabs/select-browser-tabs";
import { splitSessionGroups } from "../domain/sessions/session-groups";
import { sortSessionGroups } from "../domain/sessions/sort-session-groups";
import { bootstrapRootState, readRootState } from "../storage/local/repository";
import type { RuntimeMessage, RuntimeResponse } from "../shared/messages";
import { ROOT_STORAGE_KEY, type RootState } from "../storage/local/schema";
import type { BrowserTab } from "../types/browser";
import type { SessionGroup } from "../types/session";

const CONTEXT_MENU_IDS = {
  actionCaptureCurrentWindow: "tabvault.action.capture-current-window",
  actionOpenManager: "tabvault.action.open-manager",
  pageRoot: "tabvault.page.root",
  pageOpenManager: "tabvault.page.open-manager",
  pageCaptureCurrentWindow: "tabvault.page.capture-current-window",
  pageCaptureCurrentGroup: "tabvault.page.capture-current-group",
  pageCaptureSelectedTabs: "tabvault.page.capture-selected-tabs",
  pageCaptureCurrentTab: "tabvault.page.capture-current-tab",
  pageCaptureExceptCurrentTab: "tabvault.page.capture-except-current-tab",
  pageCaptureTabsToLeft: "tabvault.page.capture-tabs-left",
  pageCaptureTabsToRight: "tabvault.page.capture-tabs-right",
  pageCaptureAllWindows: "tabvault.page.capture-all-windows",
  pageCaptureExcludeCurrentSite: "tabvault.page.capture-exclude-current-site",
  pageRecentGroupsRoot: "tabvault.page.recent-groups",
  pageRecentGroupsEmpty: "tabvault.page.recent-groups.empty",
  pageHelp: "tabvault.page.help",
  pageSeparatorPrimary: "tabvault.page.separator-primary",
  pageSeparatorSecondary: "tabvault.page.separator-secondary",
  pageSeparatorTertiary: "tabvault.page.separator-tertiary"
} as const;

const RECENT_GROUP_MENU_PREFIX = "tabvault.page.recent-groups.item:";
const RECENT_GROUP_LIMIT = 5;

interface PageContextData {
  currentTab: BrowserTab | null;
  currentWindowTabs: BrowserTab[];
  allTabs: BrowserTab[];
  recentSessions: SessionGroup[];
}

async function openManagerPage(): Promise<void> {
  await chrome.tabs.create({
    url: chrome.runtime.getURL("manager.html")
  });
}

async function openHelpPage(): Promise<void> {
  await chrome.tabs.create({
    url: chrome.runtime.getURL("help.html")
  });
}

async function getPageContextData(tab: chrome.tabs.Tab | undefined): Promise<PageContextData> {
  const currentTab = toBrowserTab(tab ?? ({} as chrome.tabs.Tab));
  const state = await readRootState(chromeLocalStorage);
  const recentSessions = sortSessionGroups(splitSessionGroups(state.sessions).activeSessions).slice(
    0,
    RECENT_GROUP_LIMIT
  );

  if (!currentTab) {
    return {
      currentTab: null,
      currentWindowTabs: [],
      allTabs: [],
      recentSessions
    };
  }

  const [currentWindowTabs, allTabs] = await Promise.all([
    chromeTabsAdapter.listTabsInWindow(currentTab.windowId),
    chromeTabsAdapter.listAllTabs()
  ]);

  return {
    currentTab,
    currentWindowTabs,
    allTabs,
    recentSessions
  };
}

async function createContextMenu(
  properties: chrome.contextMenus.CreateProperties
): Promise<void> {
  await chrome.contextMenus.create(properties);
}

async function ensureContextMenus(): Promise<void> {
  await chrome.contextMenus.removeAll();

  const state = await readRootState(chromeLocalStorage);

  if (!state.settings.enableContextMenu) {
    return;
  }

  await createContextMenu({
    id: CONTEXT_MENU_IDS.actionCaptureCurrentWindow,
    title: "Save Tabs To TabVault",
    contexts: ["action"]
  });

  await createContextMenu({
    id: CONTEXT_MENU_IDS.actionOpenManager,
    title: "Open TabVault Manager",
    contexts: ["action"]
  });

  const recentSessions = sortSessionGroups(splitSessionGroups(state.sessions).activeSessions).slice(
    0,
    RECENT_GROUP_LIMIT
  );

  await createContextMenu({
    id: CONTEXT_MENU_IDS.pageRoot,
    title: "TabVault",
    contexts: ["page"]
  });

  await createContextMenu({
    id: CONTEXT_MENU_IDS.pageOpenManager,
    parentId: CONTEXT_MENU_IDS.pageRoot,
    title: "Open TabVault",
    contexts: ["page"]
  });

  await createContextMenu({
    id: CONTEXT_MENU_IDS.pageCaptureCurrentWindow,
    parentId: CONTEXT_MENU_IDS.pageRoot,
    title: "Send All Tabs In This Window To TabVault",
    contexts: ["page"]
  });

  await createContextMenu({
    id: CONTEXT_MENU_IDS.pageCaptureCurrentGroup,
    parentId: CONTEXT_MENU_IDS.pageRoot,
    title: "Send All Tabs In This Tab Group To TabVault",
    contexts: ["page"]
  });

  await createContextMenu({
    id: CONTEXT_MENU_IDS.pageCaptureSelectedTabs,
    parentId: CONTEXT_MENU_IDS.pageRoot,
    title: "Send Selected Tabs To TabVault",
    contexts: ["page"]
  });

  await createContextMenu({
    id: CONTEXT_MENU_IDS.pageSeparatorPrimary,
    parentId: CONTEXT_MENU_IDS.pageRoot,
    type: "separator",
    contexts: ["page"]
  });

  await createContextMenu({
    id: CONTEXT_MENU_IDS.pageCaptureCurrentTab,
    parentId: CONTEXT_MENU_IDS.pageRoot,
    title: "Only Send This Tab To TabVault",
    contexts: ["page"]
  });

  await createContextMenu({
    id: CONTEXT_MENU_IDS.pageCaptureExceptCurrentTab,
    parentId: CONTEXT_MENU_IDS.pageRoot,
    title: "Send All Tabs Except This One To TabVault",
    contexts: ["page"]
  });

  await createContextMenu({
    id: CONTEXT_MENU_IDS.pageCaptureTabsToLeft,
    parentId: CONTEXT_MENU_IDS.pageRoot,
    title: "Send Tabs To The Left To TabVault",
    contexts: ["page"]
  });

  await createContextMenu({
    id: CONTEXT_MENU_IDS.pageCaptureTabsToRight,
    parentId: CONTEXT_MENU_IDS.pageRoot,
    title: "Send Tabs To The Right To TabVault",
    contexts: ["page"]
  });

  await createContextMenu({
    id: CONTEXT_MENU_IDS.pageCaptureAllWindows,
    parentId: CONTEXT_MENU_IDS.pageRoot,
    title: "Send All Tabs In All Windows To TabVault",
    contexts: ["page"]
  });

  await createContextMenu({
    id: CONTEXT_MENU_IDS.pageCaptureExcludeCurrentSite,
    parentId: CONTEXT_MENU_IDS.pageRoot,
    title: "Exclude Current Site From This Send",
    contexts: ["page"]
  });

  await createContextMenu({
    id: CONTEXT_MENU_IDS.pageSeparatorSecondary,
    parentId: CONTEXT_MENU_IDS.pageRoot,
    type: "separator",
    contexts: ["page"]
  });

  await createContextMenu({
    id: CONTEXT_MENU_IDS.pageRecentGroupsRoot,
    parentId: CONTEXT_MENU_IDS.pageRoot,
    title: "Recent Groups",
    contexts: ["page"],
    enabled: recentSessions.length > 0
  });

  if (recentSessions.length === 0) {
    await createContextMenu({
      id: CONTEXT_MENU_IDS.pageRecentGroupsEmpty,
      parentId: CONTEXT_MENU_IDS.pageRecentGroupsRoot,
      title: "No Recent Groups",
      contexts: ["page"],
      enabled: false
    });
  }

  for (const recentSession of recentSessions) {
    await createContextMenu({
      id: `${RECENT_GROUP_MENU_PREFIX}${recentSession.id}`,
      parentId: CONTEXT_MENU_IDS.pageRecentGroupsRoot,
      title: recentSession.title,
      contexts: ["page"]
    });
  }

  await createContextMenu({
    id: CONTEXT_MENU_IDS.pageSeparatorTertiary,
    parentId: CONTEXT_MENU_IDS.pageRoot,
    type: "separator",
    contexts: ["page"]
  });

  await createContextMenu({
    id: CONTEXT_MENU_IDS.pageHelp,
    parentId: CONTEXT_MENU_IDS.pageRoot,
    title: "Help",
    contexts: ["page"]
  });
}

async function syncActionPopup(): Promise<void> {
  await chrome.action.setPopup({
    popup: "popup.html"
  });
}

async function syncRuntimeBehavior(): Promise<void> {
  await syncActionPopup();
  await ensureContextMenus();
}

let runtimeBehaviorSyncQueue: Promise<void> = Promise.resolve();

function scheduleRuntimeBehaviorSync(): Promise<void> {
  runtimeBehaviorSyncQueue = runtimeBehaviorSyncQueue
    .catch(() => {
      // Keep the queue alive after any previous failure.
    })
    .then(async () => {
      await syncRuntimeBehavior();
    });

  return runtimeBehaviorSyncQueue;
}

function didSettingsChange(previousState: unknown, nextState: unknown): boolean {
  const previousSettings = (previousState as RootState | undefined)?.settings;
  const nextSettings = (nextState as RootState | undefined)?.settings;

  return JSON.stringify(previousSettings) !== JSON.stringify(nextSettings);
}

const captureDependencies = {
  storage: chromeLocalStorage,
  tabs: chromeTabsAdapter,
  now: () => new Date()
};

async function executeCaptureBrowserTabsAction(browserTabs: BrowserTab[]) {
  return executeCaptureRuntimeAction(
    () => captureBrowserTabs(browserTabs, captureDependencies),
    {
      storage: chromeLocalStorage,
      notifications: chromeNotificationsAdapter
    }
  );
}

async function executeAddCurrentPageToRecentGroupAction(
  sessionId: string,
  browserTab: BrowserTab | null
) {
  return executeCaptureRuntimeAction(
    () => addBrowserTabToSessionGroup(sessionId, browserTab, captureDependencies),
    {
      storage: chromeLocalStorage,
      notifications: chromeNotificationsAdapter
    }
  );
}

async function handleRuntimeMessage(message: RuntimeMessage): Promise<RuntimeResponse> {
  switch (message.type) {
    case "capture/current-window": {
      return executeCaptureRuntimeAction(
        () => captureCurrentWindow(captureDependencies),
        {
          storage: chromeLocalStorage,
          notifications: chromeNotificationsAdapter
        }
      );
    }
    case "capture/current-tab": {
      return executeCaptureRuntimeAction(
        () => captureCurrentTab(captureDependencies),
        {
          storage: chromeLocalStorage,
          notifications: chromeNotificationsAdapter
        }
      );
    }
    case "capture/selected-tabs": {
      return executeCaptureRuntimeAction(
        () => captureSelectedTabs(captureDependencies),
        {
          storage: chromeLocalStorage,
          notifications: chromeNotificationsAdapter
        }
      );
    }
    case "open/manager":
      await openManagerPage();
      return {
        ok: true,
        message: "Opened the TabVault manager."
      };
    case "open/options":
      await chrome.runtime.openOptionsPage();
      return {
        ok: true,
        message: "Opened the TabVault settings page."
      };
    default:
      return {
        ok: false,
        message: "Unsupported runtime message."
      };
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  await bootstrapRootState(chromeLocalStorage);
  await scheduleRuntimeBehaviorSync();
});

chrome.runtime.onStartup.addListener(async () => {
  await bootstrapRootState(chromeLocalStorage);
  await scheduleRuntimeBehaviorSync();
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const pageContextData = await getPageContextData(tab);
  const currentTab = pageContextData.currentTab;
  const currentWindowTabs = pageContextData.currentWindowTabs;
  const currentGroupTabs = currentTab ? getBrowserTabsInSameGroup(currentWindowTabs, currentTab) : [];
  const selectedTabs = getHighlightedBrowserTabs(currentWindowTabs);
  const exceptCurrentTabs = currentTab ? getBrowserTabsExceptCurrent(currentWindowTabs, currentTab.id) : [];
  const leftTabs = currentTab ? getBrowserTabsToTheLeft(currentWindowTabs, currentTab.index) : [];
  const rightTabs = currentTab ? getBrowserTabsToTheRight(currentWindowTabs, currentTab.index) : [];
  const excludeCurrentSiteTabs = currentTab
    ? getBrowserTabsExcludingCurrentSite(currentWindowTabs, currentTab.url)
    : [];
  const menuItemId = String(info.menuItemId);

  if (menuItemId === CONTEXT_MENU_IDS.actionCaptureCurrentWindow) {
    await handleRuntimeMessage({ type: "capture/current-window" });
  }

  if (menuItemId === CONTEXT_MENU_IDS.actionOpenManager) {
    await openManagerPage();
  }

  if (menuItemId === CONTEXT_MENU_IDS.pageOpenManager) {
    await openManagerPage();
  }

  if (menuItemId === CONTEXT_MENU_IDS.pageCaptureCurrentWindow) {
    await executeCaptureBrowserTabsAction(currentWindowTabs);
  }

  if (menuItemId === CONTEXT_MENU_IDS.pageCaptureCurrentGroup) {
    await executeCaptureBrowserTabsAction(currentGroupTabs);
  }

  if (menuItemId === CONTEXT_MENU_IDS.pageCaptureSelectedTabs) {
    await executeCaptureBrowserTabsAction(selectedTabs);
  }

  if (menuItemId === CONTEXT_MENU_IDS.pageCaptureCurrentTab) {
    await executeCaptureRuntimeAction(
      () => captureBrowserTab(currentTab, captureDependencies),
      {
        storage: chromeLocalStorage,
        notifications: chromeNotificationsAdapter
      }
    );
  }

  if (menuItemId === CONTEXT_MENU_IDS.pageCaptureExceptCurrentTab) {
    await executeCaptureBrowserTabsAction(exceptCurrentTabs);
  }

  if (menuItemId === CONTEXT_MENU_IDS.pageCaptureTabsToLeft) {
    await executeCaptureBrowserTabsAction(leftTabs);
  }

  if (menuItemId === CONTEXT_MENU_IDS.pageCaptureTabsToRight) {
    await executeCaptureBrowserTabsAction(rightTabs);
  }

  if (menuItemId === CONTEXT_MENU_IDS.pageCaptureAllWindows) {
    await executeCaptureBrowserTabsAction(pageContextData.allTabs);
  }

  if (menuItemId === CONTEXT_MENU_IDS.pageCaptureExcludeCurrentSite) {
    await executeCaptureBrowserTabsAction(excludeCurrentSiteTabs);
  }

  if (menuItemId.startsWith(RECENT_GROUP_MENU_PREFIX)) {
    await executeAddCurrentPageToRecentGroupAction(
      menuItemId.slice(RECENT_GROUP_MENU_PREFIX.length),
      currentTab
    );
  }

  if (menuItemId === CONTEXT_MENU_IDS.pageHelp) {
    await openHelpPage();
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === "capture-current-window") {
    await handleRuntimeMessage({ type: "capture/current-window" });
    return;
  }

  if (command === "open-manager") {
    await openManagerPage();
  }
});

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  handleRuntimeMessage(message)
    .then((response) => {
      sendResponse(response);
    })
    .catch((error: unknown) => {
      const messageText =
        error instanceof Error ? error.message : "Unexpected runtime error in service worker.";

      sendResponse({
        ok: false,
        message: messageText
      });
    });

  return true;
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") {
    return;
  }

  const rootStateChange = changes[ROOT_STORAGE_KEY];

  if (!rootStateChange) {
    return;
  }

  if (
    didSettingsChange(rootStateChange.oldValue, rootStateChange.newValue) ||
    JSON.stringify((rootStateChange.oldValue as RootState | undefined)?.sessions) !==
      JSON.stringify((rootStateChange.newValue as RootState | undefined)?.sessions)
  ) {
    void scheduleRuntimeBehaviorSync();
  }
});
