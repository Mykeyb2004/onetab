import { describe, expect, it } from "vitest";
import {
  exportAllSessions,
  exportSingleSession
} from "../../../src/features/sessions/export-sessions";
import {
  importJsonContent,
  importSpdContent,
  importTextContent
} from "../../../src/features/sessions/import-sessions";
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

function createSessionGroup(id: string, title: string, url: string): SessionGroup {
  return {
    id,
    title,
    createdAt: "2026-04-19T10:00:00.000Z",
    updatedAt: "2026-04-19T10:00:00.000Z",
    trashedAt: null,
    tabCount: 1,
    pinned: false,
    sourceWindowId: 1,
    tabs: [
      {
        id: `tab-${id}`,
        title,
        url,
        favIconUrl: null,
        createdAt: "2026-04-19T10:00:00.000Z",
        lastOpenedAt: null,
        originalIndex: 0
      }
    ]
  };
}

describe("import/export features", () => {
  it("should export only the target group in single-session export", async () => {
    const storage = createMemoryStorage();
    const rootState = createDefaultRootState();
    rootState.sessions = [
      createSessionGroup("session-1", "One", "https://example.com/one"),
      createSessionGroup("session-2", "Two", "https://example.com/two")
    ];

    await writeRootState(storage, rootState);

    const artifact = await exportSingleSession("session-2", "json", {
      storage,
      now: () => new Date(2026, 3, 19, 20, 0)
    });
    const payload = JSON.parse(artifact.content) as { sessions: Array<{ id: string }> };

    expect(payload.sessions).toHaveLength(1);
    expect(payload.sessions[0].id).toBe("session-2");
  });

  it("should import valid text urls and skip invalid lines", async () => {
    const storage = createMemoryStorage();

    const result = await importTextContent(
      ["https://example.com/a", "not-a-url", "https://example.com/b"].join("\n"),
      {
        storage,
        now: () => new Date(2026, 3, 19, 20, 5)
      }
    );

    const state = await readRootState(storage);

    expect(result.importedGroupCount).toBe(1);
    expect(result.skippedCount).toBe(1);
    expect(state.sessions).toHaveLength(1);
    expect(state.sessions[0].tabs).toHaveLength(2);
  });

  it("should export all sessions and re-import them from json", async () => {
    const sourceStorage = createMemoryStorage();
    const sourceRootState = createDefaultRootState();
    sourceRootState.sessions = [createSessionGroup("session-1", "One", "https://example.com/one")];

    await writeRootState(sourceStorage, sourceRootState);

    const artifact = await exportAllSessions("json", {
      storage: sourceStorage,
      now: () => new Date(2026, 3, 19, 20, 10)
    });

    const targetStorage = createMemoryStorage();
    const result = await importJsonContent(artifact.content, {
      storage: targetStorage,
      now: () => new Date(2026, 3, 19, 20, 11)
    });
    const importedState = await readRootState(targetStorage);

    expect(result.importedGroupCount).toBe(1);
    expect(importedState.sessions).toHaveLength(1);
    expect(importedState.sessions[0].tabs[0].url).toBe("https://example.com/one");
  });

  it("should import spd categories as session groups and skip unsupported links", async () => {
    const storage = createMemoryStorage();
    const payload = JSON.stringify({
      categories: [
        { id: 1, icon: "home", name: "Main" },
        { id: 2, icon: "rocket", name: "AI" },
        { id: 3, icon: "box", name: "Empty" }
      ],
      links: [
        {
          id: 101,
          category: 1,
          favicon: "data:image/png;base64,abc",
          title: "OpenAI",
          url: "https://openai.com/"
        },
        {
          id: 102,
          category: 1,
          favicon: "",
          title: "   ",
          url: "https://example.com/docs"
        },
        {
          id: 103,
          category: 2,
          favicon: "",
          title: "Local file",
          url: "file:///tmp/demo.txt"
        },
        {
          id: 104,
          category: 2,
          favicon: "",
          title: "Unsupported",
          url: "chrome://extensions"
        },
        {
          id: 105,
          category: 99,
          favicon: "",
          title: "Orphan",
          url: "https://orphan.example.com/"
        }
      ],
      opts: {},
      lStorage: {}
    });

    const result = await importSpdContent(payload, {
      storage,
      now: () => new Date("2026-05-24T05:00:00.000Z")
    });
    const state = await readRootState(storage);

    expect(result.importedGroupCount).toBe(2);
    expect(result.skippedCount).toBe(3);
    expect(state.sessions).toHaveLength(2);
    expect(state.sessions.map((session) => session.title)).toEqual(["Main", "AI"]);
    expect(state.sessions[0].tabs).toHaveLength(2);
    expect(state.sessions[0].tabs[0]).toMatchObject({
      title: "OpenAI",
      url: "https://openai.com/",
      favIconUrl: "data:image/png;base64,abc"
    });
    expect(state.sessions[0].tabs[1]).toMatchObject({
      title: "https://example.com/docs",
      url: "https://example.com/docs",
      favIconUrl: null
    });
    expect(state.sessions[1].tabs).toHaveLength(1);
    expect(state.sessions[1].tabs[0]).toMatchObject({
      title: "Local file",
      url: "file:///tmp/demo.txt"
    });
  });
});
