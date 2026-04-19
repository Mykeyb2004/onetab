import { describe, expect, it } from "vitest";
import { deleteSavedTab } from "../../../src/features/sessions/delete-saved-tab";
import { deleteSessionGroup } from "../../../src/features/sessions/delete-session-group";
import { deleteSessionGroupPermanently } from "../../../src/features/sessions/delete-session-group-permanently";
import { emptyTrash } from "../../../src/features/sessions/empty-trash";
import { renameSessionGroup } from "../../../src/features/sessions/rename-session-group";
import { restoreSessionGroupFromTrash } from "../../../src/features/sessions/restore-session-group-from-trash";
import { togglePinSessionGroup } from "../../../src/features/sessions/toggle-pin-session-group";
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

function createSessionGroup(): SessionGroup {
  return {
    id: "session-1",
    title: "Initial Title",
    createdAt: "2026-04-19T10:00:00.000Z",
    updatedAt: "2026-04-19T10:00:00.000Z",
    trashedAt: null,
    tabCount: 2,
    pinned: false,
    sourceWindowId: 1,
    tabs: [
      {
        id: "tab-1",
        title: "A",
        url: "https://example.com/a",
        favIconUrl: null,
        createdAt: "2026-04-19T10:00:00.000Z",
        lastOpenedAt: null,
        originalIndex: 0
      },
      {
        id: "tab-2",
        title: "B",
        url: "https://example.com/b",
        favIconUrl: null,
        createdAt: "2026-04-19T10:00:00.000Z",
        lastOpenedAt: null,
        originalIndex: 1
      }
    ]
  };
}

describe("session management features", () => {
  it("should rename and pin a session group", async () => {
    const storage = createMemoryStorage();
    const rootState = createDefaultRootState();
    rootState.sessions = [createSessionGroup()];

    await writeRootState(storage, rootState);
    await renameSessionGroup("session-1", "Research", {
      storage,
      now: () => new Date(2026, 3, 19, 19, 0)
    });
    await togglePinSessionGroup("session-1", {
      storage,
      now: () => new Date(2026, 3, 19, 19, 5)
    });

    const state = await readRootState(storage);

    expect(state.sessions[0].title).toBe("Research");
    expect(state.sessions[0].pinned).toBe(true);
    expect(state.sessions[0].updatedAt).toBe("2026-04-19T11:05:00.000Z");
  });

  it("should delete saved tabs and move session groups into the trash", async () => {
    const storage = createMemoryStorage();
    const rootState = createDefaultRootState();
    rootState.sessions = [createSessionGroup()];

    await writeRootState(storage, rootState);
    await deleteSavedTab("session-1", "tab-1", {
      storage,
      now: () => new Date(2026, 3, 19, 19, 10)
    });

    let state = await readRootState(storage);
    expect(state.sessions[0].tabs).toHaveLength(1);

    await deleteSessionGroup("session-1", {
      storage,
      now: () => new Date(2026, 3, 19, 19, 20)
    });

    state = await readRootState(storage);
    expect(state.sessions).toHaveLength(1);
    expect(state.sessions[0].trashedAt).toBe("2026-04-19T11:20:00.000Z");
  });

  it("should restore and permanently delete trashed session groups", async () => {
    const storage = createMemoryStorage();
    const rootState = createDefaultRootState();
    rootState.sessions = [
      {
        ...createSessionGroup(),
        trashedAt: "2026-04-19T11:30:00.000Z"
      }
    ];

    await writeRootState(storage, rootState);

    await restoreSessionGroupFromTrash("session-1", {
      storage,
      now: () => new Date(2026, 3, 19, 19, 35)
    });

    let state = await readRootState(storage);
    expect(state.sessions[0].trashedAt).toBeNull();

    await deleteSessionGroup("session-1", {
      storage,
      now: () => new Date(2026, 3, 19, 19, 40)
    });
    await deleteSessionGroupPermanently("session-1", { storage });

    state = await readRootState(storage);
    expect(state.sessions).toHaveLength(0);
  });

  it("should empty the trash", async () => {
    const storage = createMemoryStorage();
    const rootState = createDefaultRootState();
    rootState.sessions = [
      {
        ...createSessionGroup(),
        id: "session-1",
        trashedAt: "2026-04-19T11:30:00.000Z"
      },
      {
        ...createSessionGroup(),
        id: "session-2",
        title: "Second Session",
        trashedAt: null
      }
    ];

    await writeRootState(storage, rootState);

    const removedCount = await emptyTrash({ storage });
    const state = await readRootState(storage);

    expect(removedCount).toBe(1);
    expect(state.sessions).toHaveLength(1);
    expect(state.sessions[0].id).toBe("session-2");
  });
});
