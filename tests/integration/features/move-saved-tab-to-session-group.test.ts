import { describe, expect, it } from "vitest";
import { moveSavedTabToSessionGroup } from "../../../src/features/sessions/move-saved-tab-to-session-group";
import {
  readRootState,
  writeRootState,
  type ExtensionStorageArea
} from "../../../src/storage/local/repository";
import { createDefaultRootState } from "../../../src/storage/local/schema";
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

function createSessionGroup(id: string, title: string, tabs: SessionGroup["tabs"]): SessionGroup {
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

describe("moveSavedTabToSessionGroup", () => {
  it("should move a saved tab from one active session group into another", async () => {
    const storage = createMemoryStorage();
    const rootState = createDefaultRootState();
    rootState.sessions = [
      createSessionGroup("session-a", "A", [
        {
          id: "tab-a1",
          title: "A1",
          url: "https://example.com/a1",
          favIconUrl: null,
          createdAt: "2026-04-19T10:00:00.000Z",
          lastOpenedAt: null,
          originalIndex: 0
        }
      ]),
      createSessionGroup("session-b", "B", [
        {
          id: "tab-b1",
          title: "B1",
          url: "https://example.com/b1",
          favIconUrl: null,
          createdAt: "2026-04-19T10:00:00.000Z",
          lastOpenedAt: null,
          originalIndex: 0
        }
      ])
    ];

    await writeRootState(storage, rootState);

    const result = await moveSavedTabToSessionGroup("session-a", "tab-a1", "session-b", {
      storage,
      now: () => new Date(2026, 3, 19, 23, 0)
    });

    const state = await readRootState(storage);
    const sourceSession = state.sessions.find((session) => session.id === "session-a");
    const targetSession = state.sessions.find((session) => session.id === "session-b");

    expect(result.ok).toBe(true);
    expect(sourceSession?.tabCount).toBe(0);
    expect(targetSession?.tabCount).toBe(2);
    expect(targetSession?.tabs.map((savedTab) => savedTab.id)).toEqual(["tab-b1", "tab-a1"]);
  });
});
