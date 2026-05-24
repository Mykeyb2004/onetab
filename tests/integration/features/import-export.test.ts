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
  return createSessionGroupWithOptions(id, title, url);
}

function createSessionGroupWithOptions(
  id: string,
  title: string,
  url: string | string[],
  options?: {
    pinned?: boolean;
    trashedAt?: string | null;
  }
): SessionGroup {
  const urls = Array.isArray(url) ? url : [url];

  return {
    id,
    title,
    createdAt: "2026-04-19T10:00:00.000Z",
    updatedAt: "2026-04-19T10:00:00.000Z",
    trashedAt: options?.trashedAt ?? null,
    tabCount: urls.length,
    pinned: options?.pinned ?? false,
    sourceWindowId: 1,
    tabs: urls.map((entry, index) => ({
      id: `tab-${id}-${index}`,
      title,
      url: entry,
      favIconUrl: null,
      createdAt: "2026-04-19T10:00:00.000Z",
      lastOpenedAt: null,
      originalIndex: index
    }))
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

  it("should skip text urls that already exist in pinned groups", async () => {
    const storage = createMemoryStorage();
    const rootState = createDefaultRootState();
    rootState.sessions = [
      createSessionGroupWithOptions("pinned-1", "Pinned", "https://example.com/a", {
        pinned: true
      })
    ];

    await writeRootState(storage, rootState);

    const result = await importTextContent(
      ["https://example.com/a", "https://example.com/b"].join("\n"),
      {
        storage,
        now: () => new Date(2026, 3, 19, 20, 6)
      }
    );
    const state = await readRootState(storage);
    const importedSession = state.sessions.find((session) => session.id !== "pinned-1");

    expect(result.importedGroupCount).toBe(1);
    expect(result.skippedCount).toBe(1);
    expect(importedSession?.tabs.map((tab) => tab.url)).toEqual(["https://example.com/b"]);
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

  it("should skip json urls that already exist in pinned groups", async () => {
    const storage = createMemoryStorage();
    const rootState = createDefaultRootState();
    rootState.sessions = [
      createSessionGroupWithOptions(
        "pinned-1",
        "Pinned",
        ["https://example.com/shared", "https://example.com/existing"],
        { pinned: true }
      )
    ];

    await writeRootState(storage, rootState);

    const result = await importJsonContent(
      JSON.stringify({
        schemaVersion: 1,
        sessions: [
          {
            title: "Imported JSON Group",
            createdAt: "2026-04-19T10:00:00.000Z",
            updatedAt: "2026-04-19T10:00:00.000Z",
            tabs: [
              {
                title: "Shared",
                url: "https://example.com/shared"
              },
              {
                title: "Fresh",
                url: "https://example.com/fresh"
              }
            ]
          }
        ]
      }),
      {
        storage,
        now: () => new Date(2026, 3, 19, 20, 12)
      }
    );
    const state = await readRootState(storage);
    const importedSession = state.sessions.find((session) => session.title === "Imported JSON Group");

    expect(result.importedGroupCount).toBe(1);
    expect(result.skippedCount).toBe(1);
    expect(importedSession?.tabs.map((tab) => tab.url)).toEqual(["https://example.com/fresh"]);
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

  it("should skip spd urls that already exist in pinned groups and drop emptied groups", async () => {
    const storage = createMemoryStorage();
    const rootState = createDefaultRootState();
    rootState.sessions = [
      createSessionGroupWithOptions(
        "pinned-1",
        "Pinned",
        ["https://openai.com/", "file:///tmp/demo.txt"],
        { pinned: true }
      )
    ];

    await writeRootState(storage, rootState);

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
          title: "Docs",
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
      now: () => new Date("2026-05-24T05:30:00.000Z")
    });
    const state = await readRootState(storage);
    const importedMain = state.sessions.find((session) => session.title === "Main");
    const importedAi = state.sessions.find((session) => session.title === "AI");

    expect(result.importedGroupCount).toBe(1);
    expect(result.skippedCount).toBe(5);
    expect(importedMain?.tabs.map((tab) => tab.url)).toEqual(["https://example.com/docs"]);
    expect(importedAi).toBeUndefined();
  });
});
