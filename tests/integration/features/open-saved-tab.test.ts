import { describe, expect, it } from "vitest";
import { openSavedTab } from "../../../src/features/sessions/open-saved-tab";
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

function createRestoreTabsAdapter(onOpenTab?: (url: string) => Promise<number | null> | number | null): RestoreTabsAdapter {
  return {
    async openTabsInNewWindow() {
      return 91;
    },
    async openTab(url) {
      return (await onOpenTab?.(url)) ?? 92;
    }
  };
}

function createSessionGroup(): SessionGroup {
  return {
    id: "session-1",
    title: "保存于 2026-04-19",
    createdAt: "2026-04-19T10:00:00.000Z",
    updatedAt: "2026-04-19T10:00:00.000Z",
    trashedAt: null,
    tabCount: 1,
    pinned: false,
    sourceWindowId: 1,
    tabs: [
      {
        id: "tab-1",
        title: "Dashboard",
        url: "https://example.com/dashboard",
        favIconUrl: null,
        createdAt: "2026-04-19T10:00:00.000Z",
        lastOpenedAt: null,
        originalIndex: 0
      }
    ]
  };
}

describe("openSavedTab", () => {
  it("should open a saved tab without removing it from the session group", async () => {
    const storage = createMemoryStorage();
    const openedUrls: string[] = [];
    const rootState = createDefaultRootState();
    rootState.sessions = [createSessionGroup()];

    await writeRootState(storage, rootState);

    const result = await openSavedTab("session-1", "tab-1", {
      storage,
      tabs: createRestoreTabsAdapter((url) => {
        openedUrls.push(url);
        return 123;
      }),
      now: () => new Date(2026, 3, 19, 21, 0)
    });

    const state = await readRootState(storage);

    expect(result.ok).toBe(true);
    expect(openedUrls).toEqual(["https://example.com/dashboard"]);
    expect(state.sessions[0].tabs).toHaveLength(1);
    expect(state.sessions[0].tabs[0].lastOpenedAt).toBe("2026-04-19T13:00:00.000Z");
  });
});
