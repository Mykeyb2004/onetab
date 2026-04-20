import { describe, expect, it } from "vitest";
import { repositionSavedTabInSessionGroups } from "../../../src/domain/sessions/reposition-saved-tab";
import type { SavedTab, SessionGroup } from "../../../src/types/session";

function createSavedTab(id: string, title: string, originalIndex: number): SavedTab {
  return {
    id,
    title,
    url: `https://example.com/${id}`,
    favIconUrl: null,
    createdAt: "2026-04-19T10:00:00.000Z",
    lastOpenedAt: null,
    originalIndex
  };
}

function createSessionGroup(id: string, title: string, tabs: SavedTab[]): SessionGroup {
  return {
    id,
    title,
    createdAt: "2026-04-19T10:00:00.000Z",
    updatedAt: "2026-04-19T10:00:00.000Z",
    trashedAt: null,
    sortOrder: 0,
    tabCount: tabs.length,
    pinned: false,
    sourceWindowId: 1,
    tabs
  };
}

describe("repositionSavedTabInSessionGroups", () => {
  it("should reorder tabs within the same session when dropped before another tab", () => {
    const result = repositionSavedTabInSessionGroups(
      [
        createSessionGroup("session-a", "A", [
          createSavedTab("tab-a1", "A1", 0),
          createSavedTab("tab-a2", "A2", 1),
          createSavedTab("tab-a3", "A3", 2)
        ])
      ],
      {
        sourceSessionId: "session-a",
        tabId: "tab-a3",
        targetSessionId: "session-a",
        targetTabId: "tab-a1",
        updatedAt: "2026-04-20T08:00:00.000Z"
      }
    );

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.changed).toBe(true);
    expect(result.sessions[0].tabs.map((savedTab) => savedTab.id)).toEqual([
      "tab-a3",
      "tab-a1",
      "tab-a2"
    ]);
    expect(result.sessions[0].tabs.map((savedTab) => savedTab.originalIndex)).toEqual([0, 1, 2]);
    expect(result.sessions[0].updatedAt).toBe("2026-04-20T08:00:00.000Z");
  });

  it("should move tabs between active sessions before a target tab", () => {
    const result = repositionSavedTabInSessionGroups(
      [
        createSessionGroup("session-a", "A", [createSavedTab("tab-a1", "A1", 0)]),
        createSessionGroup("session-b", "B", [
          createSavedTab("tab-b1", "B1", 0),
          createSavedTab("tab-b2", "B2", 1)
        ])
      ],
      {
        sourceSessionId: "session-a",
        tabId: "tab-a1",
        targetSessionId: "session-b",
        targetTabId: "tab-b2",
        updatedAt: "2026-04-20T08:05:00.000Z"
      }
    );

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    const sourceSession = result.sessions.find((sessionGroup) => sessionGroup.id === "session-a");
    const targetSession = result.sessions.find((sessionGroup) => sessionGroup.id === "session-b");

    expect(sourceSession?.tabs).toHaveLength(0);
    expect(sourceSession?.tabCount).toBe(0);
    expect(targetSession?.tabs.map((savedTab) => savedTab.id)).toEqual([
      "tab-b1",
      "tab-a1",
      "tab-b2"
    ]);
    expect(targetSession?.tabs.map((savedTab) => savedTab.originalIndex)).toEqual([0, 1, 2]);
  });

  it("should reject moving tabs from trashed sessions", () => {
    const result = repositionSavedTabInSessionGroups(
      [
        {
          ...createSessionGroup("session-a", "A", [createSavedTab("tab-a1", "A1", 0)]),
          trashedAt: "2026-04-20T08:10:00.000Z"
        },
        createSessionGroup("session-b", "B", [])
      ],
      {
        sourceSessionId: "session-a",
        tabId: "tab-a1",
        targetSessionId: "session-b",
        updatedAt: "2026-04-20T08:15:00.000Z"
      }
    );

    expect(result.ok).toBe(false);
  });
});
