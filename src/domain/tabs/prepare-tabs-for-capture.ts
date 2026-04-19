import type { BrowserTab } from "../../types/browser";
import type { CapturableTab } from "../../types/session";
import { isSupportedTabUrl } from "./is-supported-tab-url";

export type CaptureSkipReason = "unsupported-url";

export interface SkippedCaptureTab {
  tabId: number;
  url: string | undefined;
  reason: CaptureSkipReason;
}

export interface PreparedTabsForCapture {
  capturableTabs: CapturableTab[];
  closableTabIds: number[];
  skippedTabs: SkippedCaptureTab[];
  sourceWindowId: number | null;
}

export function prepareTabsForCapture(browserTabs: BrowserTab[]): PreparedTabsForCapture {
  const sortedTabs = [...browserTabs].sort((left, right) => left.index - right.index);
  const capturableTabs: CapturableTab[] = [];
  const closableTabIds: number[] = [];
  const skippedTabs: SkippedCaptureTab[] = [];

  sortedTabs.forEach((tab) => {
    const { url } = tab;

    if (!url || !isSupportedTabUrl(url)) {
      skippedTabs.push({
        tabId: tab.id,
        url,
        reason: "unsupported-url"
      });
      return;
    }

    capturableTabs.push({
      title: tab.title,
      url,
      favIconUrl: tab.favIconUrl,
      index: tab.index
    });
    closableTabIds.push(tab.id);
  });

  return {
    capturableTabs,
    closableTabIds,
    skippedTabs,
    sourceWindowId: sortedTabs[0]?.windowId ?? null
  };
}
