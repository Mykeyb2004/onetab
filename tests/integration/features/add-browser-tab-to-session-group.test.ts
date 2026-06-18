import { describe, expect, it } from "vitest";
import { DEFAULT_NOTES_GROUP_TITLE } from "../../../src/domain/sessions/default-notes-group";
import { addBrowserTabToSessionGroup } from "../../../src/features/sessions/add-browser-tab-to-session-group";
import {
  readRootState,
  writeRootState,
  type ExtensionStorageArea
} from "../../../src/storage/local/repository";
import { createDefaultRootState } from "../../../src/storage/local/schema";
import type { BrowserTab, TabsAdapter } from "../../../src/types/browser";
import type { SessionGroup } from "../../../src/types/session";

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

function createTabsAdapter(onClose?: (tabIds: number[]) => void): TabsAdapter {
  return {
    async listCurrentWindowTabs() {
      return [];
    },
    async listTabsInWindow() {
      return [];
    },
    async listAllTabs() {
      return [];
    },
    async getActiveTab() {
      return null;
    },
    async listSelectedTabs() {
      return [];
    },
    async closeTabs(tabIds) {
      onClose?.(tabIds);
    }
  };
}

function createSessionGroup(overrides: Partial<SessionGroup> = {}): SessionGroup {
  return {
    id: "session-1",
    title: "Recent Research",
    createdAt: "2026-04-19T10:00:00.000Z",
    updatedAt: "2026-04-19T10:00:00.000Z",
    trashedAt: null,
    tabCount: 1,
    pinned: false,
    sourceWindowId: 1,
    tabs: [
      {
        id: "tab-1",
        title: "Initial",
        url: "https://example.com/initial",
        favIconUrl: null,
        createdAt: "2026-04-19T10:00:00.000Z",
        lastOpenedAt: null,
        originalIndex: 0
      }
    ],
    ...overrides
  };
}

describe("addBrowserTabToSessionGroup", () => {
  it("should append the current browser tab to an existing session group and close the original tab", async () => {
    const storage = createMemoryStorage();
    let closedTabIds: number[] = [];
    const rootState = createDefaultRootState();
    rootState.sessions = [createSessionGroup()];

    await writeRootState(storage, rootState);

    const result = await addBrowserTabToSessionGroup(
      "session-1",
      {
        id: 2,
        windowId: 4,
        index: 3,
        title: "Current Page",
        url: "https://example.com/current"
      } as BrowserTab,
      {
        storage,
        tabs: createTabsAdapter((tabIds) => {
          closedTabIds = tabIds;
        }),
        now: () => new Date(2026, 3, 19, 20, 30)
      }
    );

    const state = await readRootState(storage);

    expect(result.ok).toBe(true);
    expect(closedTabIds).toEqual([2]);
    expect(state.sessions[0].tabCount).toBe(2);
    expect(state.sessions[0].tabs[1].title).toBe("Current Page");
  });

  it("should append explicit fixed or recent group captures to the chosen group instead of notes", async () => {
    const storage = createMemoryStorage();
    const rootState = createDefaultRootState();
    rootState.sessions = [
      createSessionGroup({
        id: "session-notes",
        title: DEFAULT_NOTES_GROUP_TITLE
      }),
      createSessionGroup({
        id: "session-target",
        title: "Fixed Reading",
        tabs: [],
        tabCount: 0
      })
    ];

    await writeRootState(storage, rootState);

    const result = await addBrowserTabToSessionGroup(
      "session-target",
      {
        id: 3,
        windowId: 4,
        index: 3,
        title: "Chosen Target Page",
        url: "https://example.com/chosen-target"
      } as BrowserTab,
      {
        storage,
        tabs: createTabsAdapter(),
        now: () => new Date(2026, 3, 19, 21, 0)
      }
    );

    const state = await readRootState(storage);
    const notesGroup = state.sessions.find(
      (sessionGroup) => sessionGroup.id === "session-notes"
    );
    const targetGroup = state.sessions.find(
      (sessionGroup) => sessionGroup.id === "session-target"
    );

    expect(result.ok).toBe(true);
    expect(result.sessionId).toBe("session-target");
    expect(notesGroup?.tabCount).toBe(1);
    expect(notesGroup?.tabs.map((tab) => tab.url)).toEqual([
      "https://example.com/initial"
    ]);
    expect(targetGroup?.tabCount).toBe(1);
    expect(targetGroup?.tabs.map((tab) => tab.url)).toEqual([
      "https://example.com/chosen-target"
    ]);
  });
});
