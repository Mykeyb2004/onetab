import { describe, expect, it } from "vitest";
import { selectNewTabSessionSummaries } from "../../../src/domain/sessions/select-newtab-session-summaries";
import type { SessionGroup } from "../../../src/types/session";

function createSessionGroup(overrides: Partial<SessionGroup>): SessionGroup {
  return {
    id: "session-default",
    title: "Default Session",
    createdAt: "2026-04-19T10:00:00.000Z",
    updatedAt: "2026-04-19T10:00:00.000Z",
    trashedAt: null,
    sortOrder: 0,
    tabCount: 2,
    pinned: false,
    sourceWindowId: null,
    tabs: [
      {
        id: "tab-1",
        title: "Alpha",
        url: "https://example.com/alpha",
        favIconUrl: null,
        createdAt: "2026-04-19T10:00:00.000Z",
        lastOpenedAt: null,
        originalIndex: 0
      },
      {
        id: "tab-2",
        title: "Beta",
        url: "https://example.com/beta",
        favIconUrl: null,
        createdAt: "2026-04-19T10:00:00.000Z",
        lastOpenedAt: null,
        originalIndex: 1
      }
    ],
    ...overrides
  };
}

describe("selectNewTabSessionSummaries", () => {
  it("should keep pinned sessions separate from recent sessions and skip trashed sessions", () => {
    const result = selectNewTabSessionSummaries(
      [
        createSessionGroup({
          id: "pinned-1",
          pinned: true,
          updatedAt: "2026-04-19T08:00:00.000Z"
        }),
        createSessionGroup({
          id: "recent-1",
          updatedAt: "2026-04-19T12:00:00.000Z",
          sortOrder: 10
        }),
        createSessionGroup({
          id: "trash-1",
          trashedAt: "2026-04-19T09:00:00.000Z"
        }),
        createSessionGroup({
          id: "recent-2",
          updatedAt: "2026-04-19T11:00:00.000Z",
          sortOrder: 20
        })
      ],
      { recentLimit: 1, previewLimit: 1 }
    );

    expect(result.hasSessions).toBe(true);
    expect(result.pinnedSessions.map((session) => session.id)).toEqual(["pinned-1"]);
    expect(result.recentSessions.map((session) => session.id)).toEqual(["recent-1"]);
    expect(result.recentSessions[0].previewTabs).toEqual([
      { title: "Alpha", url: "https://example.com/alpha" }
    ]);
  });
});
