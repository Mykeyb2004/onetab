import { describe, expect, it } from "vitest";
import { reorderSessionGroups } from "../../../src/features/sessions/reorder-session-groups";
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

function createSessionGroup(id: string, title: string, sortOrder: number): SessionGroup {
  return {
    id,
    title,
    createdAt: "2026-04-19T10:00:00.000Z",
    updatedAt: "2026-04-19T10:00:00.000Z",
    trashedAt: null,
    sortOrder,
    tabCount: 1,
    pinned: false,
    sourceWindowId: 1,
    tabs: [
      {
        id: `tab-${id}`,
        title,
        url: `https://example.com/${id}`,
        favIconUrl: null,
        createdAt: "2026-04-19T10:00:00.000Z",
        lastOpenedAt: null,
        originalIndex: 0
      }
    ]
  };
}

describe("reorderSessionGroups", () => {
  it("should reorder active session groups by updating sortOrder", async () => {
    const storage = createMemoryStorage();
    const rootState = createDefaultRootState();
    rootState.sessions = [
      createSessionGroup("session-a", "A", 0),
      createSessionGroup("session-b", "B", 1),
      createSessionGroup("session-c", "C", 2)
    ];

    await writeRootState(storage, rootState);
    await reorderSessionGroups("session-c", "session-a", { storage });

    const state = await readRootState(storage);

    expect(state.sessions.map((session) => session.id)).toEqual([
      "session-c",
      "session-a",
      "session-b"
    ]);
  });
});
