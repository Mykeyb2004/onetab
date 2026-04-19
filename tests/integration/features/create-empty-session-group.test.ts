import { describe, expect, it } from "vitest";
import { createEmptySessionGroup } from "../../../src/features/sessions/create-empty-session-group";
import { readRootState, type ExtensionStorageArea } from "../../../src/storage/local/repository";

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

describe("createEmptySessionGroup", () => {
  it("should create a user-named empty session group", async () => {
    const storage = createMemoryStorage();

    const sessionGroup = await createEmptySessionGroup("手动分组", {
      storage,
      now: () => new Date(2026, 3, 19, 22, 0)
    });
    const state = await readRootState(storage);

    expect(sessionGroup.title).toBe("手动分组");
    expect(sessionGroup.tabCount).toBe(0);
    expect(state.sessions).toHaveLength(1);
    expect(state.sessions[0].title).toBe("手动分组");
  });
});
