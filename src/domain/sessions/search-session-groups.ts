import type { SearchHit } from "../../types/search";
import type { SessionGroup } from "../../types/session";

export function searchSessionGroups(
  sessionGroups: SessionGroup[],
  rawQuery: string
): SearchHit[] {
  const query = rawQuery.trim().toLowerCase();

  if (!query) {
    return [];
  }

  const hits: SearchHit[] = [];

  sessionGroups.forEach((sessionGroup) => {
    if (sessionGroup.title.toLowerCase().includes(query)) {
      hits.push({
        sessionId: sessionGroup.id,
        sessionTitle: sessionGroup.title,
        tabId: null,
        matchField: "group-title",
        label: sessionGroup.title,
        url: null
      });
    }

    sessionGroup.tabs.forEach((savedTab) => {
      if (savedTab.title.toLowerCase().includes(query)) {
        hits.push({
          sessionId: sessionGroup.id,
          sessionTitle: sessionGroup.title,
          tabId: savedTab.id,
          matchField: "tab-title",
          label: savedTab.title,
          url: savedTab.url
        });
      }

      if (savedTab.url.toLowerCase().includes(query)) {
        hits.push({
          sessionId: sessionGroup.id,
          sessionTitle: sessionGroup.title,
          tabId: savedTab.id,
          matchField: "url",
          label: savedTab.url,
          url: savedTab.url
        });
      }
    });
  });

  return hits;
}
