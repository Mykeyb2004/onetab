import type { SessionGroup, SavedTab } from "../../types/session";
import { isSessionGroupTrashed } from "./session-groups";

export interface RepositionSavedTabInput {
  sourceSessionId: string;
  tabId: string;
  targetSessionId: string;
  targetTabId?: string | null;
  updatedAt: string;
}

interface RepositionSavedTabFailure {
  ok: false;
  message: string;
}

interface RepositionSavedTabSuccess {
  ok: true;
  changed: boolean;
  kind: "reordered-within-session" | "moved-between-sessions";
  movedTabTitle: string;
  targetSessionTitle: string;
  sessions: SessionGroup[];
}

export type RepositionSavedTabInSessionGroupsResult =
  | RepositionSavedTabFailure
  | RepositionSavedTabSuccess;

function reindexTabs(savedTabs: SavedTab[]): SavedTab[] {
  return savedTabs.map((savedTab, index) => ({
    ...savedTab,
    originalIndex: index
  }));
}

function hasSameTabOrder(leftTabs: SavedTab[], rightTabs: SavedTab[]): boolean {
  return (
    leftTabs.length === rightTabs.length &&
    leftTabs.every((savedTab, index) => savedTab.id === rightTabs[index]?.id)
  );
}

function insertSavedTab(savedTabs: SavedTab[], tabToInsert: SavedTab, targetIndex: number): SavedTab[] {
  const nextTabs = [...savedTabs];
  nextTabs.splice(targetIndex, 0, tabToInsert);
  return nextTabs;
}

export function repositionSavedTabInSessionGroups(
  sessionGroups: SessionGroup[],
  input: RepositionSavedTabInput
): RepositionSavedTabInSessionGroupsResult {
  const sourceSession = sessionGroups.find((sessionGroup) => sessionGroup.id === input.sourceSessionId);
  const targetSession = sessionGroups.find((sessionGroup) => sessionGroup.id === input.targetSessionId);

  if (!sourceSession || !targetSession) {
    return {
      ok: false,
      message: "源分组或目标分组不存在。"
    };
  }

  if (isSessionGroupTrashed(sourceSession) || isSessionGroupTrashed(targetSession)) {
    return {
      ok: false,
      message: "仅支持在未删除分组之间拖拽记录。"
    };
  }

  const movedTab = sourceSession.tabs.find((savedTab) => savedTab.id === input.tabId);

  if (!movedTab) {
    return {
      ok: false,
      message: "目标记录不存在。"
    };
  }

  if (input.sourceSessionId === input.targetSessionId) {
    const remainingTabs = sourceSession.tabs.filter((savedTab) => savedTab.id !== input.tabId);

    if (input.targetTabId === input.tabId) {
      return {
        ok: true,
        changed: false,
        kind: "reordered-within-session",
        movedTabTitle: movedTab.title,
        targetSessionTitle: targetSession.title,
        sessions: sessionGroups
      };
    }

    const targetIndex =
      input.targetTabId == null
        ? remainingTabs.length
        : remainingTabs.findIndex((savedTab) => savedTab.id === input.targetTabId);

    if (targetIndex < 0) {
      return {
        ok: false,
        message: "目标位置不存在。"
      };
    }

    const nextTabs = insertSavedTab(remainingTabs, movedTab, targetIndex);

    if (hasSameTabOrder(sourceSession.tabs, nextTabs)) {
      return {
        ok: true,
        changed: false,
        kind: "reordered-within-session",
        movedTabTitle: movedTab.title,
        targetSessionTitle: targetSession.title,
        sessions: sessionGroups
      };
    }

    const nextSourceSession: SessionGroup = {
      ...sourceSession,
      tabs: reindexTabs(nextTabs),
      tabCount: nextTabs.length,
      updatedAt: input.updatedAt
    };

    return {
      ok: true,
      changed: true,
      kind: "reordered-within-session",
      movedTabTitle: movedTab.title,
      targetSessionTitle: targetSession.title,
      sessions: sessionGroups.map((sessionGroup) =>
        sessionGroup.id === sourceSession.id ? nextSourceSession : sessionGroup
      )
    };
  }

  const sourceTabs = sourceSession.tabs.filter((savedTab) => savedTab.id !== input.tabId);
  const targetIndex =
    input.targetTabId == null
      ? targetSession.tabs.length
      : targetSession.tabs.findIndex((savedTab) => savedTab.id === input.targetTabId);

  if (targetIndex < 0) {
    return {
      ok: false,
      message: "目标位置不存在。"
    };
  }

  const targetTabs = insertSavedTab(targetSession.tabs, movedTab, targetIndex);
  const nextSourceSession: SessionGroup = {
    ...sourceSession,
    tabs: reindexTabs(sourceTabs),
    tabCount: sourceTabs.length,
    updatedAt: input.updatedAt
  };
  const nextTargetSession: SessionGroup = {
    ...targetSession,
    tabs: reindexTabs(targetTabs),
    tabCount: targetTabs.length,
    updatedAt: input.updatedAt
  };

  return {
    ok: true,
    changed: true,
    kind: "moved-between-sessions",
    movedTabTitle: movedTab.title,
    targetSessionTitle: targetSession.title,
    sessions: sessionGroups.map((sessionGroup) => {
      if (sessionGroup.id === nextSourceSession.id) {
        return nextSourceSession;
      }

      if (sessionGroup.id === nextTargetSession.id) {
        return nextTargetSession;
      }

      return sessionGroup;
    })
  };
}
