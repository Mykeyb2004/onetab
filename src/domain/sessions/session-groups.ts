import type { SessionGroup } from "../../types/session";

const DAILY_SESSION_TITLE_PATTERN = /^保存于 \d{4}-\d{2}-\d{2}$/;

export function isSessionGroupTrashed(sessionGroup: SessionGroup): boolean {
  return typeof sessionGroup.trashedAt === "string" && sessionGroup.trashedAt.length > 0;
}

export function isAutoDailySessionGroup(sessionGroup: SessionGroup): boolean {
  return DAILY_SESSION_TITLE_PATTERN.test(sessionGroup.title);
}

export function mergeSessionGroupsByTitle(sessionGroups: SessionGroup[]): SessionGroup[] {
  const mergedByTitle = new Map<string, SessionGroup>();

  for (const sessionGroup of sessionGroups) {
    const existingSessionGroup = mergedByTitle.get(sessionGroup.title);

    if (
      !existingSessionGroup ||
      isSessionGroupTrashed(sessionGroup) ||
      isSessionGroupTrashed(existingSessionGroup) ||
      !isAutoDailySessionGroup(sessionGroup)
    ) {
      if (existingSessionGroup && sessionGroup.title === existingSessionGroup.title) {
        mergedByTitle.set(`${sessionGroup.title}:${sessionGroup.id}`, sessionGroup);
      } else {
        mergedByTitle.set(sessionGroup.title, sessionGroup);
      }
      continue;
    }

    const nextOriginalIndexBase =
      existingSessionGroup.tabs.reduce(
        (maxValue, savedTab) => Math.max(maxValue, savedTab.originalIndex),
        -1
      ) + 1;

    const mergedTabs = [
      ...existingSessionGroup.tabs,
      ...sessionGroup.tabs.map((savedTab, index) => ({
        ...savedTab,
        originalIndex: nextOriginalIndexBase + index
      }))
    ];

    mergedByTitle.set(sessionGroup.title, {
      ...existingSessionGroup,
      createdAt:
        Date.parse(existingSessionGroup.createdAt) <= Date.parse(sessionGroup.createdAt)
          ? existingSessionGroup.createdAt
          : sessionGroup.createdAt,
      updatedAt:
        Date.parse(existingSessionGroup.updatedAt) >= Date.parse(sessionGroup.updatedAt)
          ? existingSessionGroup.updatedAt
          : sessionGroup.updatedAt,
      sortOrder:
        typeof existingSessionGroup.sortOrder === "number" && typeof sessionGroup.sortOrder === "number"
          ? Math.min(existingSessionGroup.sortOrder, sessionGroup.sortOrder)
          : existingSessionGroup.sortOrder ?? sessionGroup.sortOrder,
      pinned: existingSessionGroup.pinned || sessionGroup.pinned,
      sourceWindowId: existingSessionGroup.sourceWindowId ?? sessionGroup.sourceWindowId,
      tabCount: mergedTabs.length,
      tabs: mergedTabs
    });
  }

  return Array.from(mergedByTitle.values());
}

export function splitSessionGroups(sessionGroups: SessionGroup[]) {
  const mergedSessionGroups = mergeSessionGroupsByTitle(sessionGroups);

  return {
    activeSessions: mergedSessionGroups.filter((sessionGroup) => !isSessionGroupTrashed(sessionGroup)),
    trashedSessions: mergedSessionGroups.filter(isSessionGroupTrashed)
  };
}
