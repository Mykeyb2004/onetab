import { describe, expect, it } from "vitest";
import { readRootState, type ExtensionStorageArea } from "../../../src/storage/local/repository";
import { createDefaultRootState, ROOT_STORAGE_KEY } from "../../../src/storage/local/schema";
import { seedPreviewData } from "../../../src/preview/seed-preview-data";

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

describe("seedPreviewData", () => {
  it("should seed preview storage once from SPD content and preserve later edits", async () => {
    const storage = createMemoryStorage();
    const spdContent = JSON.stringify({
      categories: [{ id: 1, name: "Saved" }],
      links: [
        {
          category: 1,
          url: "https://example.com",
          title: "Example",
          favicon: null
        }
      ]
    });

    const seeded = await seedPreviewData(storage, spdContent);
    const firstState = await readRootState(storage);

    await storage.set({
      [ROOT_STORAGE_KEY]: {
        ...createDefaultRootState(),
        sessions: []
      }
    });

    const skipped = await seedPreviewData(storage, spdContent);
    const secondState = await readRootState(storage);

    expect(seeded).toBe(true);
    expect(firstState.sessions).toHaveLength(1);
    expect(firstState.sessions[0].title).toBe("Saved");
    expect(firstState.sessions[0].tabs[0].url).toBe("https://example.com");
    expect(skipped).toBe(false);
    expect(secondState.sessions).toHaveLength(0);
  });
});
