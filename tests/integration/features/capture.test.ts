import { describe, expect, it } from "vitest";
import { captureBrowserTab } from "../../../src/features/sessions/capture/capture-browser-tab";
import { captureCurrentTab } from "../../../src/features/sessions/capture/capture-current-tab";
import { captureCurrentWindow } from "../../../src/features/sessions/capture/capture-current-window";
import { captureSelectedTabs } from "../../../src/features/sessions/capture/capture-selected-tabs";
import { readRootState, type ExtensionStorageArea } from "../../../src/storage/local/repository";
import type { BrowserTab, TabsAdapter } from "../../../src/types/browser";

function createMemoryStorage(): ExtensionStorageArea {
  const data = new Map<string, unknown>();

  return {
    async get(key) {
      return {
        [key]: data.get(key)
      };
    },
    async set(items) {
      Object.entries(items).forEach(([key, value]) => data.set(key, value));
    },
    async remove(key) {
      data.delete(key);
    }
  };
}

function createTabsAdapter(
  tabs: BrowserTab[],
  options?: {
    onClose?: (tabIds: number[]) => Promise<void> | void;
  }
): TabsAdapter {
  return {
    async listCurrentWindowTabs() {
      return tabs;
    },
    async listTabsInWindow(windowId) {
      return tabs.filter((tab) => tab.windowId === windowId);
    },
    async listAllTabs() {
      return tabs;
    },
    async getActiveTab() {
      return tabs.find((tab) => tab.active) ?? null;
    },
    async listSelectedTabs() {
      return tabs.filter((tab) => tab.highlighted);
    },
    async closeTabs(tabIds) {
      await options?.onClose?.(tabIds);
    }
  };
}

describe("capture feature", () => {
  it("should capture all supported tabs in the current window", async () => {
    const storage = createMemoryStorage();
    let closedTabIds: number[] = [];

    const tabs = createTabsAdapter(
      [
        {
          id: 1,
          windowId: 7,
          index: 0,
          title: "Example",
          url: "https://example.com"
        },
        {
          id: 2,
          windowId: 7,
          index: 1,
          title: "Docs",
          url: "https://example.com/docs"
        }
      ],
      {
        onClose(tabIds) {
          closedTabIds = tabIds;
        }
      }
    );

    const result = await captureCurrentWindow({
      storage,
      tabs,
      now: () => new Date(2026, 3, 19, 15, 0)
    });

    const state = await readRootState(storage);

    expect(result.ok).toBe(true);
    expect(result.capturedCount).toBe(2);
    expect(result.closedCount).toBe(2);
    expect(closedTabIds).toEqual([1, 2]);
    expect(state.sessions).toHaveLength(1);
    expect(state.sessions[0].title).toBe("保存于 2026-04-19");
  });

  it("should create a session before closing tabs", async () => {
    const storage = createMemoryStorage();
    let sessionCountDuringClose = 0;

    const tabs = createTabsAdapter(
      [
        {
          id: 11,
          windowId: 8,
          index: 0,
          title: "Example",
          url: "https://example.com"
        }
      ],
      {
        async onClose() {
          const state = await readRootState(storage);
          sessionCountDuringClose = state.sessions.length;
        }
      }
    );

    await captureCurrentWindow({
      storage,
      tabs,
      now: () => new Date(2026, 3, 19, 15, 30)
    });

    expect(sessionCountDuringClose).toBe(1);
  });

  it("should report skipped unsupported tabs while still capturing supported tabs", async () => {
    const storage = createMemoryStorage();

    const tabs = createTabsAdapter([
      {
        id: 21,
        windowId: 5,
        index: 0,
        title: "Settings",
        url: "chrome://settings"
      },
      {
        id: 22,
        windowId: 5,
        index: 1,
        title: "Example",
        url: "https://example.com"
      }
    ]);

    const result = await captureCurrentWindow({
      storage,
      tabs,
      now: () => new Date(2026, 3, 19, 16, 0)
    });

    const state = await readRootState(storage);

    expect(result.ok).toBe(true);
    expect(result.capturedCount).toBe(1);
    expect(result.skippedCount).toBe(1);
    expect(result.message).toContain("skipped 1 unsupported tab");
    expect(state.sessions[0].tabs).toHaveLength(1);
  });

  it("should capture only the active tab for current-tab action", async () => {
    const storage = createMemoryStorage();
    let closedTabIds: number[] = [];

    const tabs = createTabsAdapter(
      [
        {
          id: 31,
          windowId: 5,
          index: 0,
          title: "A",
          url: "https://example.com/a"
        },
        {
          id: 32,
          windowId: 5,
          index: 1,
          title: "B",
          url: "https://example.com/b",
          active: true
        }
      ],
      {
        onClose(tabIds) {
          closedTabIds = tabIds;
        }
      }
    );

    const result = await captureCurrentTab({
      storage,
      tabs,
      now: () => new Date(2026, 3, 19, 16, 30)
    });

    const state = await readRootState(storage);

    expect(result.capturedCount).toBe(1);
    expect(closedTabIds).toEqual([32]);
    expect(state.sessions[0].tabs[0].url).toBe("https://example.com/b");
  });

  it("should keep unselected tabs open when capturing selected tabs", async () => {
    const storage = createMemoryStorage();
    let closedTabIds: number[] = [];

    const tabs = createTabsAdapter(
      [
        {
          id: 41,
          windowId: 4,
          index: 0,
          title: "A",
          url: "https://example.com/a"
        },
        {
          id: 42,
          windowId: 4,
          index: 1,
          title: "B",
          url: "https://example.com/b",
          highlighted: true
        },
        {
          id: 43,
          windowId: 4,
          index: 2,
          title: "C",
          url: "https://example.com/c",
          highlighted: true
        }
      ],
      {
        onClose(tabIds) {
          closedTabIds = tabIds;
        }
      }
    );

    const result = await captureSelectedTabs({
      storage,
      tabs,
      now: () => new Date(2026, 3, 19, 17, 0)
    });

    const state = await readRootState(storage);

    expect(result.capturedCount).toBe(2);
    expect(closedTabIds).toEqual([42, 43]);
    expect(state.sessions[0].tabs.map((tab) => tab.url)).toEqual([
      "https://example.com/b",
      "https://example.com/c"
    ]);
  });

  it("should capture only the right-clicked tab when capturing a specific browser tab", async () => {
    const storage = createMemoryStorage();
    let closedTabIds: number[] = [];

    const tabs = createTabsAdapter([], {
      onClose(tabIds) {
        closedTabIds = tabIds;
      }
    });

    const result = await captureBrowserTab(
      {
        id: 55,
        windowId: 3,
        index: 4,
        title: "Target Tab",
        url: "https://example.com/target",
        highlighted: true
      },
      {
        storage,
        tabs,
        now: () => new Date(2026, 3, 19, 17, 30)
      }
    );

    const state = await readRootState(storage);

    expect(result.capturedCount).toBe(1);
    expect(closedTabIds).toEqual([55]);
    expect(state.sessions).toHaveLength(1);
    expect(state.sessions[0].tabs[0].url).toBe("https://example.com/target");
  });
});
