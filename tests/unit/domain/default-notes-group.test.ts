import { describe, expect, it } from "vitest";
import {
  appendCapturableTabToSessionGroup,
  DEFAULT_NOTES_GROUP_TITLE,
  selectDefaultNotesGroup
} from "../../../src/domain/sessions/default-notes-group";
import type { CapturableTab, SessionGroup } from "../../../src/types/session";

function createSessionGroup(overrides: Partial<SessionGroup>): SessionGroup {
  return {
    id: "session-default",
    title: "Default",
    createdAt: "2026-04-19T10:00:00.000Z",
    updatedAt: "2026-04-19T10:00:00.000Z",
    trashedAt: null,
    sortOrder: 10,
    tabCount: 0,
    pinned: false,
    sourceWindowId: null,
    tabs: [],
    ...overrides
  };
}

describe("default notes group", () => {
  it("should select the first active notes group using session group sort order", () => {
    const result = selectDefaultNotesGroup([
      createSessionGroup({
        id: "regular",
        title: DEFAULT_NOTES_GROUP_TITLE,
        sortOrder: 20,
        updatedAt: "2026-04-19T12:00:00.000Z"
      }),
      createSessionGroup({
        id: "trashed",
        title: DEFAULT_NOTES_GROUP_TITLE,
        trashedAt: "2026-04-19T12:30:00.000Z",
        sortOrder: 1
      }),
      createSessionGroup({
        id: "pinned",
        title: DEFAULT_NOTES_GROUP_TITLE,
        pinned: true,
        sortOrder: 99,
        updatedAt: "2026-04-19T08:00:00.000Z"
      }),
      createSessionGroup({
        id: "other",
        title: "保存于 2026-04-19",
        sortOrder: 0
      })
    ]);

    expect(result?.id).toBe("pinned");
  });

  it("should return null when no active notes group exists", () => {
    const result = selectDefaultNotesGroup([
      createSessionGroup({
        id: "trashed",
        title: DEFAULT_NOTES_GROUP_TITLE,
        trashedAt: "2026-04-19T12:30:00.000Z"
      }),
      createSessionGroup({
        id: "other",
        title: "保存于 2026-04-19"
      })
    ]);

    expect(result).toBeNull();
  });

  it("should append one capturable tab while preserving existing tabs", () => {
    const sessionGroup = createSessionGroup({
      id: "session-notes",
      title: DEFAULT_NOTES_GROUP_TITLE,
      tabCount: 1,
      updatedAt: "2026-04-19T10:00:00.000Z",
      tabs: [
        {
          id: "tab-existing",
          title: "Existing",
          url: "https://example.com/existing",
          favIconUrl: null,
          createdAt: "2026-04-19T10:00:00.000Z",
          lastOpenedAt: null,
          originalIndex: 3
        }
      ]
    });
    const tab: CapturableTab = {
      title: "  Added  ",
      url: "https://example.com/added",
      favIconUrl: "https://example.com/favicon.ico",
      index: 8
    };

    const result = appendCapturableTabToSessionGroup(
      sessionGroup,
      tab,
      new Date("2026-04-20T09:15:00.000Z")
    );

    expect(result.id).toBe("session-notes");
    expect(result.tabCount).toBe(2);
    expect(result.updatedAt).toBe("2026-04-20T09:15:00.000Z");
    expect(result.tabs.map((savedTab) => savedTab.url)).toEqual([
      "https://example.com/existing",
      "https://example.com/added"
    ]);
    expect(result.tabs[1]).toEqual({
      id: "tab_session-notes_1776676500000",
      title: "Added",
      url: "https://example.com/added",
      favIconUrl: "https://example.com/favicon.ico",
      createdAt: "2026-04-20T09:15:00.000Z",
      lastOpenedAt: null,
      originalIndex: 4
    });
  });
});
