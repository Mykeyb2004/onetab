import type { BrowserTab, TabsAdapter } from "../../types/browser";

export function toBrowserTab(tab: chrome.tabs.Tab): BrowserTab | null {
  if (
    typeof tab.id !== "number" ||
    typeof tab.windowId !== "number" ||
    typeof tab.index !== "number"
  ) {
    return null;
  }

  return {
    id: tab.id,
    windowId: tab.windowId,
    index: tab.index,
    groupId: tab.groupId,
    title: tab.title,
    url: tab.url,
    favIconUrl: tab.favIconUrl,
    active: tab.active,
    highlighted: tab.highlighted
  };
}

async function queryTabs(queryInfo: chrome.tabs.QueryInfo): Promise<BrowserTab[]> {
  const tabs = await chrome.tabs.query(queryInfo);

  return tabs
    .map(toBrowserTab)
    .filter((tab): tab is BrowserTab => tab !== null);
}

export const chromeTabsAdapter: TabsAdapter = {
  async listCurrentWindowTabs() {
    return queryTabs({
      currentWindow: true
    });
  },

  async listTabsInWindow(windowId) {
    return queryTabs({
      windowId
    });
  },

  async listAllTabs() {
    return queryTabs({});
  },

  async getActiveTab() {
    const tabs = await queryTabs({
      currentWindow: true,
      active: true
    });

    return tabs[0] ?? null;
  },

  async listSelectedTabs() {
    return queryTabs({
      currentWindow: true,
      highlighted: true
    });
  },

  async closeTabs(tabIds) {
    if (tabIds.length === 0) {
      return;
    }

    await chrome.tabs.remove(tabIds);
  }
};
