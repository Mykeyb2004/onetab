import { describe, expect, it } from "vitest";
import { selectPageTargetGroups } from "../../../src/domain/sessions/select-page-target-groups";
import type { SessionGroup } from "../../../src/types/session";

function createSessionGroup(overrides: Partial<SessionGroup>): SessionGroup {
  return {
    id: "session-default",
    title: "Default",
    createdAt: "2026-04-19T10:00:00.000Z",
    updatedAt: "2026-04-19T10:00:00.000Z",
    trashedAt: null,
    sortOrder: 0,
    tabCount: 0,
    pinned: false,
    sourceWindowId: null,
    tabs: [],
    ...overrides
  };
}

describe("selectPageTargetGroups", () => {
  it("should keep pinned groups as fixed page targets while limiting recent groups", () => {
    const result = selectPageTargetGroups(
      [
        createSessionGroup({
          id: "old-pinned",
          title: "Pinned Later",
          pinned: true,
          updatedAt: "2026-04-19T08:00:00.000Z",
          sortOrder: 40
        }),
        createSessionGroup({
          id: "recent-1",
          title: "Recent 1",
          updatedAt: "2026-04-19T13:00:00.000Z",
          sortOrder: 10
        }),
        createSessionGroup({
          id: "trash",
          title: "Trash",
          trashedAt: "2026-04-19T12:30:00.000Z",
          updatedAt: "2026-04-19T12:30:00.000Z",
          sortOrder: 5
        }),
        createSessionGroup({
          id: "recent-2",
          title: "Recent 2",
          updatedAt: "2026-04-19T12:00:00.000Z",
          sortOrder: 20
        }),
        createSessionGroup({
          id: "recent-3",
          title: "Recent 3",
          updatedAt: "2026-04-19T11:00:00.000Z",
          sortOrder: 30
        }),
        createSessionGroup({
          id: "top-pinned",
          title: "Pinned First",
          pinned: true,
          updatedAt: "2026-04-19T07:00:00.000Z",
          sortOrder: 1
        })
      ],
      { recentLimit: 2 }
    );

    expect(result.pinnedGroups.map((session) => session.id)).toEqual([
      "top-pinned",
      "old-pinned"
    ]);
    expect(result.recentGroups.map((session) => session.id)).toEqual([
      "recent-1",
      "recent-2"
    ]);
  });
});
