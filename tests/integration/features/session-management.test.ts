import { describe, expect, it } from "vitest";
import { batchDeleteSessionGroupsPermanently } from "../../../src/features/sessions/batch-session-groups";
import { batchMoveSessionGroupsToTrash } from "../../../src/features/sessions/batch-session-groups";
import { batchRestoreSessionGroupsFromTrash } from "../../../src/features/sessions/batch-session-groups";
import { mergeSessionGroupsIntoDefaultNotesGroup } from "../../../src/features/sessions/batch-session-groups";
import { deleteSavedTab } from "../../../src/features/sessions/delete-saved-tab";
import { deleteSessionGroup } from "../../../src/features/sessions/delete-session-group";
import { deleteSessionGroupPermanently } from "../../../src/features/sessions/delete-session-group-permanently";
import { emptyTrash } from "../../../src/features/sessions/empty-trash";
import { DEFAULT_NOTES_GROUP_TITLE } from "../../../src/domain/sessions/default-notes-group";
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

function createSessionGroup(overrides: Partial<SessionGroup> = {}): SessionGroup {
  const id = overrides.id ?? "session-1";

  return {
    id,
    title: "Initial Title",
    createdAt: "2026-04-19T10:00:00.000Z",
    updatedAt: "2026-04-19T10:00:00.000Z",
    trashedAt: null,
    tabCount: 2,
    pinned: false,
    sourceWindowId: 1,
    tabs: [
      {
        id: `tab-${id}-1`,
        title: "A",
        url: `https://example.com/${id}/a`,
        favIconUrl: null,
        createdAt: "2026-04-19T10:00:00.000Z",
        lastOpenedAt: null,
        originalIndex: 0
      },
      {
        id: `tab-${id}-2`,
        title: "B",
        url: `https://example.com/${id}/b`,
        favIconUrl: null,
        createdAt: "2026-04-19T10:00:00.000Z",
        lastOpenedAt: null,
        originalIndex: 1
      }
    ],
    ...overrides
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
    await deleteSavedTab("session-1", "tab-session-1-1", {
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

  it("should batch move active session groups into the trash", async () => {
    const storage = createMemoryStorage();
    const rootState = createDefaultRootState();
    rootState.sessions = [
      createSessionGroup({ id: "session-1", title: "One" }),
      createSessionGroup({ id: "session-2", title: "Two" }),
      createSessionGroup({ id: "session-3", title: "Three" })
    ];

    await writeRootState(storage, rootState);

    const movedCount = await batchMoveSessionGroupsToTrash(["session-1", "session-2"], {
      storage,
      now: () => new Date("2026-04-19T11:20:00.000Z")
    });
    const state = await readRootState(storage);

    expect(movedCount).toBe(2);
    expect(state.sessions.find((session) => session.id === "session-1")?.trashedAt).toBe(
      "2026-04-19T11:20:00.000Z"
    );
    expect(state.sessions.find((session) => session.id === "session-2")?.trashedAt).toBe(
      "2026-04-19T11:20:00.000Z"
    );
    expect(state.sessions.find((session) => session.id === "session-3")?.trashedAt).toBeNull();
  });

  it("should reject trash ids when batch moving active groups to trash", async () => {
    const storage = createMemoryStorage();
    const rootState = createDefaultRootState();
    rootState.sessions = [
      createSessionGroup({ id: "session-1", trashedAt: "2026-04-19T10:30:00.000Z" })
    ];

    await writeRootState(storage, rootState);

    await expect(
      batchMoveSessionGroupsToTrash(["session-1"], {
        storage,
        now: () => new Date("2026-04-19T11:20:00.000Z")
      })
    ).rejects.toThrow("Only active session groups can be moved to trash.");
  });

  it("should merge active session groups into an existing notes group and remove sources", async () => {
    const storage = createMemoryStorage();
    const rootState = createDefaultRootState();
    rootState.sessions = [
      createSessionGroup({
        id: "notes",
        title: DEFAULT_NOTES_GROUP_TITLE,
        tabCount: 1,
        tabs: [
          {
            id: "tab-notes-1",
            title: "Existing",
            url: "https://example.com/existing",
            favIconUrl: null,
            createdAt: "2026-04-19T09:00:00.000Z",
            lastOpenedAt: null,
            originalIndex: 4
          }
        ]
      }),
      createSessionGroup({ id: "session-1", title: "One" }),
      createSessionGroup({ id: "session-2", title: "Two" })
    ];

    await writeRootState(storage, rootState);

    const result = await mergeSessionGroupsIntoDefaultNotesGroup(["notes", "session-1", "session-2"], {
      storage,
      now: () => new Date("2026-04-19T12:00:00.000Z")
    });
    const state = await readRootState(storage);
    const notes = state.sessions.find((session) => session.id === "notes");

    expect(result.mergedGroupCount).toBe(2);
    expect(result.mergedTabCount).toBe(4);
    expect(notes?.tabCount).toBe(5);
    expect(notes?.updatedAt).toBe("2026-04-19T12:00:00.000Z");
    expect(notes?.tabs.map((tab) => tab.originalIndex)).toEqual([4, 5, 6, 7, 8]);
    expect(state.sessions.some((session) => session.id === "session-1")).toBe(false);
    expect(state.sessions.some((session) => session.id === "session-2")).toBe(false);
    expect(state.sessions.some((session) => session.id === "notes")).toBe(true);
  });

  it("should create notes group when merging active groups and no notes group exists", async () => {
    const storage = createMemoryStorage();
    const rootState = createDefaultRootState();
    rootState.sessions = [
      createSessionGroup({ id: "session-1", title: "One" }),
      createSessionGroup({ id: "session-2", title: "Two" })
    ];

    await writeRootState(storage, rootState);

    const result = await mergeSessionGroupsIntoDefaultNotesGroup(["session-1", "session-2"], {
      storage,
      now: () => new Date("2026-04-19T12:00:00.000Z")
    });
    const state = await readRootState(storage);
    const notes = state.sessions.find((session) => session.title === DEFAULT_NOTES_GROUP_TITLE);

    expect(result.targetSession.title).toBe(DEFAULT_NOTES_GROUP_TITLE);
    expect(result.mergedGroupCount).toBe(2);
    expect(result.mergedTabCount).toBe(4);
    expect(notes?.tabCount).toBe(4);
    expect(notes?.tabs.map((tab) => tab.originalIndex)).toEqual([0, 1, 2, 3]);
    expect(state.sessions).toHaveLength(1);
  });

  it("should reject trash groups when merging into notes", async () => {
    const storage = createMemoryStorage();
    const rootState = createDefaultRootState();
    rootState.sessions = [
      createSessionGroup({
        id: "session-1",
        title: "One",
        trashedAt: "2026-04-19T10:30:00.000Z"
      })
    ];

    await writeRootState(storage, rootState);

    await expect(
      mergeSessionGroupsIntoDefaultNotesGroup(["session-1"], {
        storage,
        now: () => new Date("2026-04-19T12:00:00.000Z")
      })
    ).rejects.toThrow("Only active session groups can be merged into notes.");
  });

  it("should batch restore trash session groups", async () => {
    const storage = createMemoryStorage();
    const rootState = createDefaultRootState();
    rootState.sessions = [
      createSessionGroup({ id: "session-1", trashedAt: "2026-04-19T10:30:00.000Z" }),
      createSessionGroup({ id: "session-2", trashedAt: "2026-04-19T10:35:00.000Z" })
    ];

    await writeRootState(storage, rootState);

    const restoredCount = await batchRestoreSessionGroupsFromTrash(["session-1", "session-2"], {
      storage,
      now: () => new Date("2026-04-19T12:30:00.000Z")
    });
    const state = await readRootState(storage);

    expect(restoredCount).toBe(2);
    expect(state.sessions.every((session) => session.trashedAt === null)).toBe(true);
    expect(state.sessions.every((session) => session.updatedAt === "2026-04-19T12:30:00.000Z")).toBe(
      true
    );
  });

  it("should batch permanently delete trash session groups and reject active ids", async () => {
    const storage = createMemoryStorage();
    const rootState = createDefaultRootState();
    rootState.sessions = [
      createSessionGroup({ id: "session-1", trashedAt: "2026-04-19T10:30:00.000Z" }),
      createSessionGroup({ id: "session-2", trashedAt: "2026-04-19T10:35:00.000Z" }),
      createSessionGroup({ id: "session-3", trashedAt: null })
    ];

    await writeRootState(storage, rootState);

    await expect(batchDeleteSessionGroupsPermanently(["session-3"], { storage })).rejects.toThrow(
      "Only trash session groups can be permanently deleted."
    );

    const deletedCount = await batchDeleteSessionGroupsPermanently(["session-1", "session-2"], {
      storage
    });
    const state = await readRootState(storage);

    expect(deletedCount).toBe(2);
    expect(state.sessions.map((session) => session.id)).toEqual(["session-3"]);
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
