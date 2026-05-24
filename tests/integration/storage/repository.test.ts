import { describe, expect, it } from "vitest";
import { createSessionGroup } from "../../../src/domain/sessions/create-session-group";
import {
  appendSessionGroup,
  readRootState,
  updateSettings,
  type ExtensionStorageArea
} from "../../../src/storage/local/repository";
import { ROOT_STORAGE_KEY } from "../../../src/storage/local/schema";

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

describe("local repository", () => {
  it("should bootstrap an empty root state when storage is empty", async () => {
    const storage = createMemoryStorage();
    const state = await readRootState(storage);

    expect(state.schemaVersion).toBe(1);
    expect(state.sessions).toEqual([]);
    expect(state.settings.restoreBehavior).toBe("remove-group");
    expect(state.settings.managerGridDensityPreference).toBe("enhanced");
    expect(state.settings.managerSidebarPreference).toBe("expanded");
  });

  it("should append session groups and persist settings changes", async () => {
    const storage = createMemoryStorage();
    const group = createSessionGroup(
      [{ url: "https://example.com", title: "Example", index: 0 }],
      {
        now: new Date(2026, 3, 19, 10, 45)
      }
    );

    await appendSessionGroup(storage, group);
    await updateSettings(storage, {
      defaultClickAction: "open-manager",
      enableContextMenu: false,
      managerGridDensityPreference: "compact",
      managerSidebarPreference: "collapsed"
    });

    const state = await readRootState(storage);

    expect(state.sessions).toHaveLength(1);
    expect(state.sessions[0].title).toBe("保存于 2026-04-19");
    expect(state.settings.defaultClickAction).toBe("open-manager");
    expect(state.settings.enableContextMenu).toBe(false);
    expect(state.settings.managerGridDensityPreference).toBe("compact");
    expect(state.settings.managerSidebarPreference).toBe("collapsed");
  });

  it("should migrate legacy saved sessions without clearing user data", async () => {
    const storage = createMemoryStorage();

    await storage.set({
      [ROOT_STORAGE_KEY]: {
        schemaVersion: 1,
        settings: {
          restoreBehavior: "keep-group"
        },
        sessions: [
          {
            id: "legacy-session",
            title: "Legacy Session",
            createdAt: "2026-04-19T10:00:00.000Z",
            updatedAt: "2026-04-19T11:00:00.000Z",
            tabs: [
              {
                id: "legacy-tab",
                title: "Legacy Tab",
                url: "https://example.com/legacy"
              }
            ]
          }
        ]
      }
    });

    const state = await readRootState(storage);

    expect(state.sessions).toHaveLength(1);
    expect(state.sessions[0]).toMatchObject({
      id: "legacy-session",
      title: "Legacy Session",
      pinned: false,
      trashedAt: null,
      tabCount: 1
    });
    expect(state.sessions[0].tabs[0]).toMatchObject({
      id: "legacy-tab",
      title: "Legacy Tab",
      url: "https://example.com/legacy"
    });
    expect(state.settings.restoreBehavior).toBe("keep-group");
    expect(state.settings.enableContextMenu).toBe(true);
    expect(state.settings.managerGridDensityPreference).toBe("enhanced");
    expect(state.settings.managerSidebarPreference).toBe("expanded");
  });
});
