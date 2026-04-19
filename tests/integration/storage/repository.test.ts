import { describe, expect, it } from "vitest";
import { createSessionGroup } from "../../../src/domain/sessions/create-session-group";
import {
  appendSessionGroup,
  readRootState,
  updateSettings,
  type ExtensionStorageArea
} from "../../../src/storage/local/repository";

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
      enableContextMenu: false
    });

    const state = await readRootState(storage);

    expect(state.sessions).toHaveLength(1);
    expect(state.sessions[0].title).toBe("保存于 2026-04-19");
    expect(state.settings.defaultClickAction).toBe("open-manager");
    expect(state.settings.enableContextMenu).toBe(false);
  });
});
