import { chromeLocalStorage } from "../../adapters/chrome/storage";
import { isSessionGroupTrashed } from "../../domain/sessions/session-groups";
import { sortSessionGroups } from "../../domain/sessions/sort-session-groups";
import {
  readRootState,
  writeRootState,
  type ExtensionStorageArea
} from "../../storage/local/repository";
import type { SessionGroup } from "../../types/session";

interface ReorderSessionGroupsDependencies {
  storage: ExtensionStorageArea;
}

function reorderWithinList(
  sessionGroups: SessionGroup[],
  draggedSessionId: string,
  targetSessionId: string
): SessionGroup[] {
  const currentIndex = sessionGroups.findIndex((sessionGroup) => sessionGroup.id === draggedSessionId);
  const targetIndex = sessionGroups.findIndex((sessionGroup) => sessionGroup.id === targetSessionId);

  if (currentIndex === -1 || targetIndex === -1 || currentIndex === targetIndex) {
    return sessionGroups;
  }

  const nextSessionGroups = [...sessionGroups];
  const [draggedSessionGroup] = nextSessionGroups.splice(currentIndex, 1);
  nextSessionGroups.splice(targetIndex, 0, draggedSessionGroup);

  return nextSessionGroups.map((sessionGroup, index) => ({
    ...sessionGroup,
    sortOrder: index
  }));
}

export async function reorderSessionGroups(
  draggedSessionId: string,
  targetSessionId: string,
  dependencies: ReorderSessionGroupsDependencies = {
    storage: chromeLocalStorage
  }
): Promise<SessionGroup[]> {
  const state = await readRootState(dependencies.storage);
  const activeSessions = sortSessionGroups(
    state.sessions.filter((sessionGroup) => !isSessionGroupTrashed(sessionGroup))
  );
  const trashedSessions = sortSessionGroups(
    state.sessions.filter(isSessionGroupTrashed)
  ).map((sessionGroup, index) => ({
    ...sessionGroup,
    sortOrder: typeof sessionGroup.sortOrder === "number" ? sessionGroup.sortOrder : 10_000 + index
  }));

  const reorderedActiveSessions = reorderWithinList(activeSessions, draggedSessionId, targetSessionId);
  const nextSessions = [...reorderedActiveSessions, ...trashedSessions];

  await writeRootState(dependencies.storage, {
    ...state,
    sessions: nextSessions
  });

  return reorderedActiveSessions;
}
