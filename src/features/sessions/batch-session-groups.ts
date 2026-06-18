import { chromeLocalStorage } from "../../adapters/chrome/storage";
import { createSessionGroup } from "../../domain/sessions/create-session-group";
import {
  DEFAULT_NOTES_GROUP_TITLE,
  selectDefaultNotesGroup
} from "../../domain/sessions/default-notes-group";
import { isSessionGroupTrashed } from "../../domain/sessions/session-groups";
import {
  readRootState,
  writeRootState,
  type ExtensionStorageArea
} from "../../storage/local/repository";
import type { SessionGroup } from "../../types/session";

interface BatchSessionGroupDependencies {
  storage: ExtensionStorageArea;
  now?: () => Date;
}

interface BatchDeleteSessionGroupsPermanentlyDependencies {
  storage: ExtensionStorageArea;
}

export interface MergeSessionGroupsIntoDefaultNotesGroupResult {
  targetSession: SessionGroup;
  mergedGroupCount: number;
  mergedTabCount: number;
}

function uniqueSessionIds(sessionIds: string[]): string[] {
  return Array.from(new Set(sessionIds.map((sessionId) => sessionId.trim()).filter(Boolean)));
}

function requireSelection(sessionIds: string[]): string[] {
  const selectedSessionIds = uniqueSessionIds(sessionIds);

  if (selectedSessionIds.length === 0) {
    throw new Error("Select at least one session group.");
  }

  return selectedSessionIds;
}

function selectSessionsById(sessionGroups: SessionGroup[], sessionIds: string[]): SessionGroup[] {
  const selectedIds = new Set(sessionIds);
  const selectedSessions = sessionGroups.filter((session) => selectedIds.has(session.id));

  if (selectedSessions.length !== selectedIds.size) {
    throw new Error("Session group not found.");
  }

  return selectedSessions;
}

function getNextTopActiveSortOrder(sessionGroups: SessionGroup[]): number {
  const activeSortOrders = sessionGroups
    .filter((session) => !isSessionGroupTrashed(session))
    .map((session) => session.sortOrder)
    .filter((sortOrder): sortOrder is number => typeof sortOrder === "number");

  return activeSortOrders.length > 0 ? Math.min(...activeSortOrders) - 1 : 0;
}

export async function batchMoveSessionGroupsToTrash(
  sessionIds: string[],
  dependencies: BatchSessionGroupDependencies = {
    storage: chromeLocalStorage,
    now: () => new Date()
  }
): Promise<number> {
  const selectedSessionIds = requireSelection(sessionIds);
  const state = await readRootState(dependencies.storage);
  const selectedSessions = selectSessionsById(state.sessions, selectedSessionIds);

  if (selectedSessions.some(isSessionGroupTrashed)) {
    throw new Error("Only active session groups can be moved to trash.");
  }

  const trashedAt = (dependencies.now?.() ?? new Date()).toISOString();
  const selectedIds = new Set(selectedSessionIds);
  const nextSessions = state.sessions.map((session) =>
    selectedIds.has(session.id)
      ? {
          ...session,
          trashedAt,
          updatedAt: trashedAt
        }
      : session
  );

  await writeRootState(dependencies.storage, {
    ...state,
    sessions: nextSessions
  });

  return selectedSessions.length;
}

export async function mergeSessionGroupsIntoDefaultNotesGroup(
  sessionIds: string[],
  dependencies: BatchSessionGroupDependencies = {
    storage: chromeLocalStorage,
    now: () => new Date()
  }
): Promise<MergeSessionGroupsIntoDefaultNotesGroupResult> {
  const selectedSessionIds = requireSelection(sessionIds);
  const state = await readRootState(dependencies.storage);
  const now = dependencies.now?.() ?? new Date();
  const mergedAt = now.toISOString();
  const existingTarget = selectDefaultNotesGroup(state.sessions);

  if (existingTarget !== null && selectedSessionIds.includes(existingTarget.id)) {
    throw new Error("The default notes group cannot be selected for merge.");
  }

  const sourceIds = new Set(selectedSessionIds);

  if (sourceIds.size === 0) {
    throw new Error("Select at least one non-notes session group.");
  }

  const sourceSessions = selectSessionsById(state.sessions, Array.from(sourceIds));

  if (sourceSessions.some(isSessionGroupTrashed)) {
    throw new Error("Only active session groups can be merged into notes.");
  }

  const targetSession =
    existingTarget ??
    {
      ...createSessionGroup([], {
        now,
        title: DEFAULT_NOTES_GROUP_TITLE,
        sourceWindowId: null
      }),
      sortOrder: getNextTopActiveSortOrder(state.sessions)
    };

  let nextOriginalIndex =
    targetSession.tabs.reduce((maxValue, savedTab) => Math.max(maxValue, savedTab.originalIndex), -1) +
    1;

  const movedTabs = sourceSessions.flatMap((session) =>
    session.tabs.map((savedTab) => ({
      ...savedTab,
      originalIndex: nextOriginalIndex++
    }))
  );

  const nextTargetSession: SessionGroup = {
    ...targetSession,
    tabs: [...targetSession.tabs, ...movedTabs],
    tabCount: targetSession.tabs.length + movedTabs.length,
    updatedAt: mergedAt
  };

  let targetWasInserted = false;
  const nextSessions = state.sessions.flatMap((session) => {
    if (sourceIds.has(session.id)) {
      return [];
    }

    if (session.id === nextTargetSession.id) {
      targetWasInserted = true;
      return [nextTargetSession];
    }

    return [session];
  });

  if (!targetWasInserted) {
    nextSessions.unshift(nextTargetSession);
  }

  await writeRootState(dependencies.storage, {
    ...state,
    sessions: nextSessions
  });

  return {
    targetSession: nextTargetSession,
    mergedGroupCount: sourceSessions.length,
    mergedTabCount: movedTabs.length
  };
}

export async function batchRestoreSessionGroupsFromTrash(
  sessionIds: string[],
  dependencies: BatchSessionGroupDependencies = {
    storage: chromeLocalStorage,
    now: () => new Date()
  }
): Promise<number> {
  const selectedSessionIds = requireSelection(sessionIds);
  const state = await readRootState(dependencies.storage);
  const selectedSessions = selectSessionsById(state.sessions, selectedSessionIds);

  if (selectedSessions.some((session) => !isSessionGroupTrashed(session))) {
    throw new Error("Only trash session groups can be restored.");
  }

  const restoredAt = (dependencies.now?.() ?? new Date()).toISOString();
  const selectedIds = new Set(selectedSessionIds);
  const nextSessions = state.sessions.map((session) =>
    selectedIds.has(session.id)
      ? {
          ...session,
          trashedAt: null,
          updatedAt: restoredAt
        }
      : session
  );

  await writeRootState(dependencies.storage, {
    ...state,
    sessions: nextSessions
  });

  return selectedSessions.length;
}

export async function batchDeleteSessionGroupsPermanently(
  sessionIds: string[],
  dependencies: BatchDeleteSessionGroupsPermanentlyDependencies = {
    storage: chromeLocalStorage
  }
): Promise<number> {
  const selectedSessionIds = requireSelection(sessionIds);
  const state = await readRootState(dependencies.storage);
  const selectedSessions = selectSessionsById(state.sessions, selectedSessionIds);

  if (selectedSessions.some((session) => !isSessionGroupTrashed(session))) {
    throw new Error("Only trash session groups can be permanently deleted.");
  }

  const selectedIds = new Set(selectedSessionIds);

  await writeRootState(dependencies.storage, {
    ...state,
    sessions: state.sessions.filter((session) => !selectedIds.has(session.id))
  });

  return selectedSessions.length;
}
