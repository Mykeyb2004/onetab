import type { SessionGroup } from "../../types/session";

export function sortSessionGroups(sessionGroups: SessionGroup[]): SessionGroup[] {
  return [...sessionGroups].sort((left, right) => {
    if (left.pinned !== right.pinned) {
      return left.pinned ? -1 : 1;
    }

    return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
  });
}
