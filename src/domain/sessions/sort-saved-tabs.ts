import type { SavedTab } from "../../types/session";

export function sortSavedTabsByOriginalIndex(savedTabs: SavedTab[]): SavedTab[] {
  return [...savedTabs].sort((left, right) => left.originalIndex - right.originalIndex);
}
