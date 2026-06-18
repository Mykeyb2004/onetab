import type { CapturableTab, SessionGroup } from "../../types/session";
import { isSessionGroupTrashed } from "./session-groups";
import { sortSessionGroups } from "./sort-session-groups";

export const DEFAULT_NOTES_GROUP_TITLE = "笔记";

export function selectDefaultNotesGroup(sessionGroups: SessionGroup[]): SessionGroup | null {
  const notesGroups = sessionGroups.filter(
    (sessionGroup) =>
      sessionGroup.title === DEFAULT_NOTES_GROUP_TITLE && !isSessionGroupTrashed(sessionGroup)
  );

  return sortSessionGroups(notesGroups)[0] ?? null;
}

export function appendCapturableTabToSessionGroup(
  sessionGroup: SessionGroup,
  tab: CapturableTab,
  now: Date
): SessionGroup {
  const nextOriginalIndex =
    sessionGroup.tabs.reduce((maxValue, savedTab) => Math.max(maxValue, savedTab.originalIndex), -1) +
    1;
  const createdAt = now.toISOString();

  return {
    ...sessionGroup,
    tabs: [
      ...sessionGroup.tabs,
      {
        id: `tab_${sessionGroup.id}_${now.getTime()}`,
        title: tab.title?.trim() || tab.url,
        url: tab.url,
        favIconUrl: tab.favIconUrl ?? null,
        createdAt,
        lastOpenedAt: null,
        originalIndex: nextOriginalIndex
      }
    ],
    tabCount: sessionGroup.tabCount + 1,
    updatedAt: createdAt
  };
}
