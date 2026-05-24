import type { SessionGroup } from "../../types/session";
import { sortSessionGroups } from "./sort-session-groups";
import { splitSessionGroups } from "./session-groups";

export interface PageTargetGroups {
  pinnedGroups: SessionGroup[];
  recentGroups: SessionGroup[];
}

export function selectPageTargetGroups(
  sessionGroups: SessionGroup[],
  options: { recentLimit?: number } = {}
): PageTargetGroups {
  const recentLimit = options.recentLimit ?? 5;
  const { activeSessions } = splitSessionGroups(sessionGroups);
  const sortedActiveSessions = sortSessionGroups(activeSessions);

  return {
    pinnedGroups: sortedActiveSessions.filter((sessionGroup) => sessionGroup.pinned),
    recentGroups: sortedActiveSessions
      .filter((sessionGroup) => !sessionGroup.pinned)
      .slice(0, recentLimit)
  };
}
