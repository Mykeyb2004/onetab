import type { SessionGroup } from "../../types/session";

export function sortSessionGroups(sessionGroups: SessionGroup[]): SessionGroup[] {
  return [...sessionGroups].sort((left, right) => {
    if (left.pinned !== right.pinned) {
      return left.pinned ? -1 : 1;
    }

    if (typeof left.sortOrder === "number" || typeof right.sortOrder === "number") {
      const leftOrder = typeof left.sortOrder === "number" ? left.sortOrder : Number.MAX_SAFE_INTEGER;
      const rightOrder = typeof right.sortOrder === "number" ? right.sortOrder : Number.MAX_SAFE_INTEGER;

      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }
    }

    return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
  });
}
