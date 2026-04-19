import { describe, expect, it } from "vitest";
import { prepareTabsForCapture } from "../../../src/domain/tabs/prepare-tabs-for-capture";

describe("prepareTabsForCapture", () => {
  it("should keep supported tabs in original index order and skip unsupported urls", () => {
    const prepared = prepareTabsForCapture([
      {
        id: 2,
        windowId: 9,
        index: 5,
        title: "Unsupported",
        url: "chrome://extensions"
      },
      {
        id: 1,
        windowId: 9,
        index: 1,
        title: "Example",
        url: "https://example.com"
      }
    ]);

    expect(prepared.capturableTabs).toEqual([
      {
        title: "Example",
        url: "https://example.com",
        favIconUrl: undefined,
        index: 1
      }
    ]);
    expect(prepared.closableTabIds).toEqual([1]);
    expect(prepared.skippedTabs).toEqual([
      {
        tabId: 2,
        url: "chrome://extensions",
        reason: "unsupported-url"
      }
    ]);
    expect(prepared.sourceWindowId).toBe(9);
  });
});
