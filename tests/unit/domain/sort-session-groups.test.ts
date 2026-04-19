import { describe, expect, it } from "vitest";
import { sortSessionGroups } from "../../../src/domain/sessions/sort-session-groups";
import type { SessionGroup } from "../../../src/types/session";

function createSessionGroup(overrides: Partial<SessionGroup>): SessionGroup {
  return {
    id: "session-default",
    title: "Default",
    createdAt: "2026-04-19T10:00:00.000Z",
    updatedAt: "2026-04-19T10:00:00.000Z",
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

describe("sortSessionGroups", () => {
  it("should place pinned groups before non-pinned groups and then sort by updatedAt", () => {
    const sessions = sortSessionGroups([
      createSessionGroup({
        id: "older",
        title: "Older",
        updatedAt: "2026-04-19T10:00:00.000Z"
      }),
      createSessionGroup({
        id: "newer",
        title: "Newer",
        updatedAt: "2026-04-19T12:00:00.000Z"
      }),
      createSessionGroup({
        id: "pinned",
        title: "Pinned",
        pinned: true,
        updatedAt: "2026-04-19T09:00:00.000Z"
      })
    ]);

    expect(sessions.map((session) => session.id)).toEqual(["pinned", "newer", "older"]);
  });
});
