import { describe, expect, it } from "vitest";
import { searchSessionGroups } from "../../../src/domain/sessions/search-session-groups";
import type { SessionGroup } from "../../../src/types/session";

function createSessionGroup(): SessionGroup {
  return {
    id: "session-1",
    title: "Research Links",
    createdAt: "2026-04-19T10:00:00.000Z",
    updatedAt: "2026-04-19T10:00:00.000Z",
    tabCount: 2,
    pinned: false,
    sourceWindowId: 1,
    tabs: [
      {
        id: "tab-1",
        title: "React Compiler Notes",
        url: "https://example.com/react-compiler",
        favIconUrl: null,
        createdAt: "2026-04-19T10:00:00.000Z",
        lastOpenedAt: null,
        originalIndex: 0
      },
      {
        id: "tab-2",
        title: "Testing Docs",
        url: "https://docs.example.com/testing",
        favIconUrl: null,
        createdAt: "2026-04-19T10:00:00.000Z",
        lastOpenedAt: null,
        originalIndex: 1
      }
    ]
  };
}

describe("searchSessionGroups", () => {
  it("should match group titles, tab titles, and urls", () => {
    const sessions = [createSessionGroup()];

    expect(searchSessionGroups(sessions, "research").map((hit) => hit.matchField)).toContain(
      "group-title"
    );
    expect(searchSessionGroups(sessions, "compiler").map((hit) => hit.matchField)).toContain(
      "tab-title"
    );
    expect(searchSessionGroups(sessions, "docs.example.com").map((hit) => hit.matchField)).toContain(
      "url"
    );
  });

  it("should return no hits for empty queries", () => {
    expect(searchSessionGroups([createSessionGroup()], "   ")).toEqual([]);
  });
});
