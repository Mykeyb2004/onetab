import { describe, expect, it } from "vitest";
import { DEFAULT_NOTES_GROUP_TITLE } from "../../../src/domain/sessions/default-notes-group";
import { captureBrowserTab } from "../../../src/features/sessions/capture/capture-browser-tab";
import { captureCurrentTab } from "../../../src/features/sessions/capture/capture-current-tab";
import { captureCurrentWindow } from "../../../src/features/sessions/capture/capture-current-window";
import { captureSelectedTabs } from "../../../src/features/sessions/capture/capture-selected-tabs";
import {
  readRootState,
  writeRootState,
  type ExtensionStorageArea
} from "../../../src/storage/local/repository";
import type { BrowserTab, TabsAdapter } from "../../../src/types/browser";
import type { SessionGroup } from "../../../src/types/session";

function createMemoryStorage(options?: {
  onSet?: (items: Record<string, unknown>) => Promise<void> | void;
}): ExtensionStorageArea {
  const data = new Map<string, unknown>();

  return {
    async get(key) {
      return {
        [key]: data.get(key)
      };
    },
    async set(items) {
      await options?.onSet?.(items);
      Object.entries(items).forEach(([key, value]) => data.set(key, value));
    },
    async remove(key) {
      data.delete(key);
    }
  };
}

function createStoredSessionGroup(overrides: Partial<SessionGroup>): SessionGroup {
  return {
    id: "session-default",
    title: "保存于 2026-04-19",
    createdAt: "2026-04-19T10:00:00.000Z",
    updatedAt: "2026-04-19T10:00:00.000Z",
    trashedAt: null,
    sortOrder: 10,
    tabCount: 1,
    pinned: false,
    sourceWindowId: 1,
    tabs: [
      {
        id: "tab-default",
        title: "Existing",
        url: "https://example.com/existing",
        favIconUrl: null,
        createdAt: "2026-04-19T10:00:00.000Z",
        lastOpenedAt: null,
        originalIndex: 0
      }
    ],
    ...overrides
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
    expect(state.sessions[0].title).toBe(DEFAULT_NOTES_GROUP_TITLE);
    expect(result.message).toBe(`Added the current page to "${DEFAULT_NOTES_GROUP_TITLE}".`);
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
    expect(state.sessions[0].title).toBe(DEFAULT_NOTES_GROUP_TITLE);
    expect(result.message).toBe(`Added the current page to "${DEFAULT_NOTES_GROUP_TITLE}".`);
  });

  it("should reuse an existing active notes group for current-tab capture", async () => {
    const storage = createMemoryStorage();
    const rootState = await readRootState(storage);
    rootState.sessions = [
      createStoredSessionGroup({
        id: "session-notes",
        title: DEFAULT_NOTES_GROUP_TITLE,
        sortOrder: 1,
        updatedAt: "2026-04-19T10:00:00.000Z",
        tabCount: 1,
        tabs: [
          {
            id: "tab-existing",
            title: "Existing",
            url: "https://example.com/existing",
            favIconUrl: null,
            createdAt: "2026-04-19T10:00:00.000Z",
            lastOpenedAt: null,
            originalIndex: 2
          }
        ]
      })
    ];
    await writeRootState(storage, rootState);
    let closedTabIds: number[] = [];
    const tabs = createTabsAdapter(
      [
        {
          id: 61,
          windowId: 6,
          index: 3,
          title: "Added",
          url: "https://example.com/added",
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
      now: () => new Date("2026-04-20T09:15:00.000Z")
    });

    const state = await readRootState(storage);

    expect(result.ok).toBe(true);
    expect(result.createdGroupId).toBe("session-notes");
    expect(closedTabIds).toEqual([61]);
    expect(state.sessions).toHaveLength(1);
    expect(state.sessions[0].id).toBe("session-notes");
    expect(state.sessions[0].tabCount).toBe(2);
    expect(state.sessions[0].updatedAt).toBe("2026-04-20T09:15:00.000Z");
    expect(state.sessions[0].tabs.map((tab) => tab.url)).toEqual([
      "https://example.com/existing",
      "https://example.com/added"
    ]);
    expect(state.sessions[0].tabs[1].originalIndex).toBe(3);
  });

  it("should create a new active notes group when only a trashed notes group exists", async () => {
    const storage = createMemoryStorage();
    const rootState = await readRootState(storage);
    rootState.sessions = [
      createStoredSessionGroup({
        id: "session-notes-trashed",
        title: DEFAULT_NOTES_GROUP_TITLE,
        trashedAt: "2026-04-19T12:00:00.000Z"
      })
    ];
    await writeRootState(storage, rootState);
    const tabs = createTabsAdapter([
      {
        id: 71,
        windowId: 7,
        index: 0,
        title: "Fresh",
        url: "https://example.com/fresh",
        active: true
      }
    ]);

    const result = await captureCurrentTab({
      storage,
      tabs,
      now: () => new Date("2026-04-20T11:00:00.000Z")
    });

    const state = await readRootState(storage);
    const activeNotesGroup = state.sessions.find(
      (session) => session.title === DEFAULT_NOTES_GROUP_TITLE && !session.trashedAt
    );
    const trashedNotesGroup = state.sessions.find(
      (session) => session.id === "session-notes-trashed"
    );

    expect(result.createdGroupId).toBe("session_1776682800000");
    expect(state.sessions).toHaveLength(2);
    expect(activeNotesGroup?.tabs.map((tab) => tab.url)).toEqual([
      "https://example.com/fresh"
    ]);
    expect(trashedNotesGroup?.trashedAt).toBe("2026-04-19T12:00:00.000Z");
  });

  it("should keep the original tab open when notes capture storage write fails", async () => {
    const storage = createMemoryStorage({
      onSet() {
        throw new Error("write failed");
      }
    });
    let closedTabIds: number[] = [];
    const tabs = createTabsAdapter([], {
      onClose(tabIds) {
        closedTabIds = tabIds;
      }
    });

    await expect(
      captureBrowserTab(
        {
          id: 81,
          windowId: 8,
          index: 0,
          title: "Write Failure",
          url: "https://example.com/write-failure"
        },
        {
          storage,
          tabs,
          now: () => new Date("2026-04-20T12:00:00.000Z")
        }
      )
    ).rejects.toThrow("write failed");

    expect(closedTabIds).toEqual([]);
  });
});
