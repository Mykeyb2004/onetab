export type SearchMatchField = "group-title" | "tab-title" | "url";

export interface SearchHit {
  sessionId: string;
  sessionTitle: string;
  tabId: string | null;
  matchField: SearchMatchField;
  label: string;
  url: string | null;
}
