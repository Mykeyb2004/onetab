import { describe, expect, it } from "vitest";
import { repositionSavedTab } from "../../../src/features/sessions/reposition-saved-tab";
import {
  readRootState,
  writeRootState,
  type ExtensionStorageArea
} from "../../../src/storage/local/repository";
import { createDefaultRootState } from "../../../src/storage/local/schema";
import type { SavedTab, SessionGroup } from "../../../src/types/session";

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

function createSavedTab(id: string, title: string, originalIndex: number): SavedTab {
  return {
    id,
    title,
    url: `https://example.com/${id}`,
    favIconUrl: null,
    createdAt: "2026-04-19T10:00:00.000Z",
    lastOpenedAt: null,
    originalIndex
  };
}

function createSessionGroup(id: string, title: string, tabs: SavedTab[]): SessionGroup {
  return {
    id,
    title,
    createdAt: "2026-04-19T10:00:00.000Z",
    updatedAt: "2026-04-19T10:00:00.000Z",
    trashedAt: null,
    sortOrder: 0,
    tabCount: tabs.length,
    pinned: false,
    sourceWindowId: 1,
    tabs
  };
}

describe("repositionSavedTab", () => {
  it("should persist a reordered tab within the same session", async () => {
    const storage = createMemoryStorage();
    const rootState = createDefaultRootState();
    rootState.sessions = [
      createSessionGroup("session-a", "A", [
        createSavedTab("tab-a1", "A1", 0),
        createSavedTab("tab-a2", "A2", 1),
        createSavedTab("tab-a3", "A3", 2)
      ])
    ];

    await writeRootState(storage, rootState);

    const result = await repositionSavedTab(
      "session-a",
      "tab-a3",
      "session-a",
      {
        targetTabId: "tab-a1"
      },
      {
        storage,
        now: () => new Date(2026, 3, 20, 16, 0)
      }
    );

    const state = await readRootState(storage);

    expect(result.ok).toBe(true);
    expect(result.changed).toBe(true);
    expect(state.sessions[0].tabs.map((savedTab) => savedTab.id)).toEqual([
      "tab-a3",
      "tab-a1",
      "tab-a2"
    ]);
    expect(state.sessions[0].updatedAt).toBe("2026-04-20T08:00:00.000Z");
  });

  it("should persist a moved tab before a target tab in another session", async () => {
    const storage = createMemoryStorage();
    const rootState = createDefaultRootState();
    rootState.sessions = [
      createSessionGroup("session-a", "A", [createSavedTab("tab-a1", "A1", 0)]),
      createSessionGroup("session-b", "B", [
        createSavedTab("tab-b1", "B1", 0),
        createSavedTab("tab-b2", "B2", 1)
      ])
    ];

    await writeRootState(storage, rootState);

    const result = await repositionSavedTab(
      "session-a",
      "tab-a1",
      "session-b",
      {
        targetTabId: "tab-b2"
      },
      {
        storage,
        now: () => new Date(2026, 3, 20, 16, 5)
      }
    );

    const state = await readRootState(storage);
    const sourceSession = state.sessions.find((sessionGroup) => sessionGroup.id === "session-a");
    const targetSession = state.sessions.find((sessionGroup) => sessionGroup.id === "session-b");

    expect(result.ok).toBe(true);
    expect(sourceSession?.tabCount).toBe(0);
    expect(targetSession?.tabs.map((savedTab) => savedTab.id)).toEqual([
      "tab-b1",
      "tab-a1",
      "tab-b2"
    ]);
    expect(targetSession?.tabs.map((savedTab) => savedTab.originalIndex)).toEqual([0, 1, 2]);
  });
});
