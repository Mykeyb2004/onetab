import { describe, expect, it } from "vitest";
import { loadNewTabPageState } from "../../../src/features/newtab/load-newtab-page-state";
import { createSessionGroup } from "../../../src/domain/sessions/create-session-group";
import { appendSessionGroup, type ExtensionStorageArea } from "../../../src/storage/local/repository";

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

describe("loadNewTabPageState", () => {
  it("should return an empty state when no sessions exist", async () => {
    const storage = createMemoryStorage();

    const result = await loadNewTabPageState({ storage });

    expect(result.hasSessions).toBe(false);
    expect(result.pinnedSessions).toEqual([]);
    expect(result.recentSessions).toEqual([]);
  });

  it("should expose recent session summaries from persisted root state", async () => {
    const storage = createMemoryStorage();
    const group = createSessionGroup(
      [{ url: "https://example.com", title: "Example", index: 0 }],
      {
        now: new Date(2026, 3, 19, 10, 45)
      }
    );

    await appendSessionGroup(storage, group);

    const result = await loadNewTabPageState({
      storage,
      recentLimit: 3,
      previewLimit: 2
    });

    expect(result.hasSessions).toBe(true);
    expect(result.recentSessions[0].id).toBe(group.id);
    expect(result.recentSessions[0].tabCount).toBe(1);
  });
});
