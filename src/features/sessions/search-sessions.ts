import { searchSessionGroups } from "../../domain/sessions/search-session-groups";
import type { SearchHit } from "../../types/search";
import type { SessionGroup } from "../../types/session";

export function searchSessions(query: string, sessionGroups: SessionGroup[]): SearchHit[] {
  return searchSessionGroups(sessionGroups, query);
}
