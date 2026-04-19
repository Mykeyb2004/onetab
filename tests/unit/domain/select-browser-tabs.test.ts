import { describe, expect, it } from "vitest";
import {
  countCapturableBrowserTabs,
  getBrowserTabsExcludingCurrentSite,
  getBrowserTabsExceptCurrent,
  getBrowserTabsInSameGroup,
  getBrowserTabsToTheLeft,
  getBrowserTabsToTheRight,
  getCurrentSiteLabel,
  getHighlightedBrowserTabs
} from "../../../src/domain/tabs/select-browser-tabs";
import type { BrowserTab } from "../../../src/types/browser";

const browserTabs: BrowserTab[] = [
  {
    id: 1,
    windowId: 1,
    index: 0,
    groupId: -1,
    title: "A",
    url: "https://www.bilibili.com/video",
    highlighted: false
  },
  {
    id: 2,
    windowId: 1,
    index: 1,
    groupId: 8,
    title: "B",
    url: "https://www.example.com/page",
    highlighted: true
  },
  {
    id: 3,
    windowId: 1,
    index: 2,
    groupId: 8,
    title: "C",
    url: "https://docs.example.com",
    highlighted: true
  }
];

describe("select-browser-tabs", () => {
  it("should find highlighted tabs and count capturable tabs", () => {
    expect(getHighlightedBrowserTabs(browserTabs).map((browserTab) => browserTab.id)).toEqual([2, 3]);
    expect(countCapturableBrowserTabs(browserTabs)).toBe(3);
  });

  it("should find tabs in the same tab group", () => {
    expect(getBrowserTabsInSameGroup(browserTabs, browserTabs[1]).map((browserTab) => browserTab.id)).toEqual([2, 3]);
  });

  it("should split tabs around the current tab", () => {
    expect(getBrowserTabsExceptCurrent(browserTabs, 2).map((browserTab) => browserTab.id)).toEqual([1, 3]);
    expect(getBrowserTabsToTheLeft(browserTabs, 1).map((browserTab) => browserTab.id)).toEqual([1]);
    expect(getBrowserTabsToTheRight(browserTabs, 1).map((browserTab) => browserTab.id)).toEqual([3]);
  });

  it("should exclude tabs on the current site", () => {
    expect(getCurrentSiteLabel("https://www.bilibili.com/video")).toBe("www.bilibili.com");
    expect(
      getBrowserTabsExcludingCurrentSite(browserTabs, "https://www.example.com/page").map(
        (browserTab) => browserTab.id
      )
    ).toEqual([1, 3]);
  });
});
