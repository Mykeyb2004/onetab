import type { RestoreTabsAdapter } from "../../types/browser";

export const chromeRestoreTabsAdapter: RestoreTabsAdapter = {
  async openTabsInNewWindow(urls) {
    if (urls.length === 0) {
      return null;
    }

    const createdWindow = await chrome.windows.create({
      url: urls.length === 1 ? urls[0] : urls,
      focused: true
    });

    return createdWindow?.id ?? null;
  },

  async openTab(url) {
    const createdTab = await chrome.tabs.create({ url });
    return createdTab?.id ?? null;
  },

  async replaceCurrentTab(url) {
    const currentTab = await chrome.tabs.getCurrent();

    if (currentTab?.id == null) {
      return this.openTab(url);
    }

    const updatedTab = await chrome.tabs.update(currentTab.id, {
      url,
      active: true
    });

    return updatedTab?.id ?? currentTab.id;
  }
};
