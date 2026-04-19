import { describe, expect, it } from "vitest";
import { mergeSessionGroupsByTitle, splitSessionGroups } from "../../../src/domain/sessions/session-groups";
import type { SessionGroup } from "../../../src/types/session";

function createSessionGroup(overrides: Partial<SessionGroup>): SessionGroup {
  return {
    id: "session-default",
    title: "保存于 2026-04-19",
    createdAt: "2026-04-19T10:00:00.000Z",
    updatedAt: "2026-04-19T10:00:00.000Z",
    trashedAt: null,
    tabCount: 1,
    pinned: false,
    sourceWindowId: 1,
    tabs: [
      {
        id: "tab-default",
        title: "Example",
        url: "https://example.com",
        favIconUrl: null,
        createdAt: "2026-04-19T10:00:00.000Z",
        lastOpenedAt: null,
        originalIndex: 0
      }
    ],
    ...overrides
  };
}

describe("session-groups", () => {
  it("should merge same-day auto-named active session groups", () => {
    const mergedSessionGroups = mergeSessionGroupsByTitle([
      createSessionGroup({
        id: "session-1",
        tabs: [
          {
            id: "tab-1",
            title: "One",
            url: "https://example.com/one",
            favIconUrl: null,
            createdAt: "2026-04-19T10:00:00.000Z",
            lastOpenedAt: null,
            originalIndex: 0
          }
        ],
        tabCount: 1
      }),
      createSessionGroup({
        id: "session-2",
        tabs: [
          {
            id: "tab-2",
            title: "Two",
            url: "https://example.com/two",
            favIconUrl: null,
            createdAt: "2026-04-19T12:00:00.000Z",
            lastOpenedAt: null,
            originalIndex: 0
          }
        ],
        tabCount: 1,
        updatedAt: "2026-04-19T12:00:00.000Z"
      })
    ]);

    expect(mergedSessionGroups).toHaveLength(1);
    expect(mergedSessionGroups[0].tabCount).toBe(2);
    expect(mergedSessionGroups[0].tabs.map((savedTab) => savedTab.title)).toEqual(["One", "Two"]);
  });

  it("should keep trashed groups separate from active groups", () => {
    const { activeSessions, trashedSessions } = splitSessionGroups([
      createSessionGroup({
        id: "session-1",
        trashedAt: null
      }),
      createSessionGroup({
        id: "session-2",
        trashedAt: "2026-04-19T12:00:00.000Z"
      })
    ]);

    expect(activeSessions).toHaveLength(1);
    expect(trashedSessions).toHaveLength(1);
  });
});
