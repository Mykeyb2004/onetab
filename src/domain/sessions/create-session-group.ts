import type { CapturableTab, SessionGroup } from "../../types/session";
import { formatSessionTitle } from "./format-session-title";

export function createSessionGroup(
  tabs: CapturableTab[],
  options?: {
    now?: Date;
    sourceWindowId?: number | null;
    title?: string;
  }
): SessionGroup {
  const now = options?.now ?? new Date();
  const createdAt = now.toISOString();
  const sessionIdSeed = now.getTime().toString();
  const title = options?.title ?? formatSessionTitle(now);

  const savedTabs = tabs.map((tab, index) => ({
    id: `tab_${sessionIdSeed}_${index}`,
    title: tab.title?.trim() || tab.url,
    url: tab.url,
    favIconUrl: tab.favIconUrl ?? null,
    createdAt,
    lastOpenedAt: null,
    originalIndex: tab.index
  }));

  return {
    id: `session_${sessionIdSeed}`,
    title,
    createdAt,
    updatedAt: createdAt,
    trashedAt: null,
    tabCount: savedTabs.length,
    pinned: false,
    sourceWindowId: options?.sourceWindowId ?? null,
    tabs: savedTabs
  };
}
