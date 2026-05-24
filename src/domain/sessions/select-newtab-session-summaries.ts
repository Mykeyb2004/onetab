import type { SessionGroup } from "../../types/session";
import { selectPageTargetGroups } from "./select-page-target-groups";

export interface NewTabSessionPreviewTab {
  title: string;
  url: string;
}

export interface NewTabSessionSummary {
  id: string;
  title: string;
  updatedAt: string;
  tabCount: number;
  pinned: boolean;
  previewTabs: NewTabSessionPreviewTab[];
}

export interface NewTabSessionSummaryCollection {
  hasSessions: boolean;
  pinnedSessions: NewTabSessionSummary[];
  recentSessions: NewTabSessionSummary[];
}

export function selectNewTabSessionSummaries(
  sessionGroups: SessionGroup[],
  options: { recentLimit?: number; previewLimit?: number } = {}
): NewTabSessionSummaryCollection {
  const recentLimit = options.recentLimit ?? 4;
  const previewLimit = options.previewLimit ?? 3;
  const { pinnedGroups, recentGroups } = selectPageTargetGroups(sessionGroups, {
    recentLimit
  });

  const toSummary = (session: SessionGroup): NewTabSessionSummary => ({
    id: session.id,
    title: session.title,
    updatedAt: session.updatedAt,
    tabCount: session.tabCount,
    pinned: session.pinned,
    previewTabs: session.tabs.slice(0, previewLimit).map((tab) => ({
      title: tab.title,
      url: tab.url
    }))
  });

  return {
    hasSessions: pinnedGroups.length > 0 || recentGroups.length > 0,
    pinnedSessions: pinnedGroups.map(toSummary),
    recentSessions: recentGroups.map(toSummary)
  };
}
