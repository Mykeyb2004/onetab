import type { BrowserTab } from "../../types/browser";
import { isSupportedTabUrl } from "./is-supported-tab-url";

export function isCapturableBrowserTab(browserTab: BrowserTab): boolean {
  return isSupportedTabUrl(browserTab.url);
}

export function countCapturableBrowserTabs(browserTabs: BrowserTab[]): number {
  return browserTabs.filter(isCapturableBrowserTab).length;
}

export function getHighlightedBrowserTabs(browserTabs: BrowserTab[]): BrowserTab[] {
  return browserTabs.filter((browserTab) => browserTab.highlighted);
}

export function getBrowserTabsInSameGroup(
  browserTabs: BrowserTab[],
  currentTab: BrowserTab
): BrowserTab[] {
  if (typeof currentTab.groupId !== "number" || currentTab.groupId < 0) {
    return [];
  }

  return browserTabs.filter((browserTab) => browserTab.groupId === currentTab.groupId);
}

export function getBrowserTabsExceptCurrent(
  browserTabs: BrowserTab[],
  currentTabId: number
): BrowserTab[] {
  return browserTabs.filter((browserTab) => browserTab.id !== currentTabId);
}

export function getBrowserTabsToTheLeft(
  browserTabs: BrowserTab[],
  currentIndex: number
): BrowserTab[] {
  return browserTabs.filter((browserTab) => browserTab.index < currentIndex);
}

export function getBrowserTabsToTheRight(
  browserTabs: BrowserTab[],
  currentIndex: number
): BrowserTab[] {
  return browserTabs.filter((browserTab) => browserTab.index > currentIndex);
}

export function getCurrentSiteLabel(url: string | undefined): string | null {
  if (!url) {
    return null;
  }

  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

export function getBrowserTabsExcludingCurrentSite(
  browserTabs: BrowserTab[],
  currentUrl: string | undefined
): BrowserTab[] {
  const currentSiteLabel = getCurrentSiteLabel(currentUrl);

  if (!currentSiteLabel) {
    return [];
  }

  return browserTabs.filter((browserTab) => getCurrentSiteLabel(browserTab.url) !== currentSiteLabel);
}
