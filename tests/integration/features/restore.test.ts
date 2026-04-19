import { describe, expect, it } from "vitest";
import { restoreSavedTab } from "../../../src/features/sessions/restore/restore-saved-tab";
import { restoreSessionGroup } from "../../../src/features/sessions/restore/restore-session-group";
import {
  readRootState,
  writeRootState,
  type ExtensionStorageArea
} from "../../../src/storage/local/repository";
import { createDefaultRootState } from "../../../src/storage/local/schema";
import type { RestoreTabsAdapter } from "../../../src/types/browser";
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

function createRestoreTabsAdapter(options?: {
  onOpenTabsInNewWindow?: (urls: string[]) => Promise<number | null> | number | null;
  onOpenTab?: (url: string) => Promise<number | null> | number | null;
}): RestoreTabsAdapter {
  return {
    async openTabsInNewWindow(urls) {
      return (await options?.onOpenTabsInNewWindow?.(urls)) ?? 91;
    },
    async openTab(url) {
      return (await options?.onOpenTab?.(url)) ?? 92;
    }
  };
}

function createSessionGroup(): SessionGroup {
  return {
    id: "session-1",
    title: "保存于 2026-04-19 18:00",
    createdAt: "2026-04-19T10:00:00.000Z",
    updatedAt: "2026-04-19T10:00:00.000Z",
    trashedAt: null,
    tabCount: 2,
    pinned: false,
    sourceWindowId: 5,
    tabs: [
      {
        id: "tab-2",
        title: "Second",
        url: "https://example.com/second",
        favIconUrl: null,
        createdAt: "2026-04-19T10:00:00.000Z",
        lastOpenedAt: null,
        originalIndex: 2
      },
      {
        id: "tab-1",
        title: "First",
        url: "https://example.com/first",
        favIconUrl: null,
        createdAt: "2026-04-19T10:00:00.000Z",
        lastOpenedAt: null,
        originalIndex: 0
      }
    ]
  };
}

describe("restore features", () => {
  it("should restore a group into a new window in original order", async () => {
    const storage = createMemoryStorage();
    const urlsOpened: string[] = [];
    const rootState = createDefaultRootState();
    rootState.sessions = [createSessionGroup()];

    await writeRootState(storage, rootState);

    const result = await restoreSessionGroup("session-1", {
      storage,
      tabs: createRestoreTabsAdapter({
        onOpenTabsInNewWindow(urls) {
          urlsOpened.push(...urls);
          return 100;
        }
      }),
      now: () => new Date(2026, 3, 19, 18, 15)
    });

    const state = await readRootState(storage);

    expect(result.ok).toBe(true);
    expect(result.windowId).toBe(100);
    expect(urlsOpened).toEqual([
      "https://example.com/first",
      "https://example.com/second"
    ]);
    expect(state.sessions).toHaveLength(0);
  });

  it("should keep the group after restore when keep-group is enabled", async () => {
    const storage = createMemoryStorage();
    const rootState = createDefaultRootState();
    rootState.settings.restoreBehavior = "keep-group";
    rootState.sessions = [createSessionGroup()];

    await writeRootState(storage, rootState);

    await restoreSessionGroup("session-1", {
      storage,
      tabs: createRestoreTabsAdapter(),
      now: () => new Date(2026, 3, 19, 18, 20)
    });

    const state = await readRootState(storage);

    expect(state.sessions).toHaveLength(1);
    expect(state.sessions[0].tabs.every((tab) => tab.lastOpenedAt !== null)).toBe(true);
  });

  it("should remove a restored tab from the original group", async () => {
    const storage = createMemoryStorage();
    const openedUrls: string[] = [];
    const rootState = createDefaultRootState();
    rootState.sessions = [createSessionGroup()];

    await writeRootState(storage, rootState);

    const result = await restoreSavedTab("session-1", "tab-1", {
      storage,
      tabs: createRestoreTabsAdapter({
        onOpenTab(url) {
          openedUrls.push(url);
          return 300;
        }
      }),
      now: () => new Date(2026, 3, 19, 18, 30)
    });

    const state = await readRootState(storage);

    expect(result.ok).toBe(true);
    expect(openedUrls).toEqual(["https://example.com/first"]);
    expect(state.sessions).toHaveLength(1);
    expect(state.sessions[0].tabs).toHaveLength(1);
    expect(state.sessions[0].tabs[0].id).toBe("tab-2");
    expect(state.sessions[0].tabCount).toBe(1);
  });

  it("should delete the group when the last tab is restored", async () => {
    const storage = createMemoryStorage();
    const rootState = createDefaultRootState();
    rootState.sessions = [
      {
        ...createSessionGroup(),
        tabCount: 1,
        tabs: [createSessionGroup().tabs[0]]
      }
    ];

    await writeRootState(storage, rootState);

    const result = await restoreSavedTab("session-1", "tab-2", {
      storage,
      tabs: createRestoreTabsAdapter(),
      now: () => new Date(2026, 3, 19, 18, 45)
    });

    const state = await readRootState(storage);

    expect(result.ok).toBe(true);
    expect(result.removedGroup).toBe(true);
    expect(state.sessions).toHaveLength(0);
  });
});
