import type { ExtensionSettings } from "../../types/settings";
import type { SavedTab, SessionGroup } from "../../types/session";

export const ROOT_STORAGE_KEY = "tabvault:root";
export const SCHEMA_VERSION = 1;

export interface RootState {
  schemaVersion: number;
  sessions: SessionGroup[];
  settings: ExtensionSettings;
}

export const defaultSettings: ExtensionSettings = {
  restoreBehavior: "remove-group",
  defaultClickAction: "capture-current-window",
  showCaptureFeedback: true,
  enableContextMenu: true,
  managerGridDensityPreference: "enhanced"
};

export function createDefaultRootState(): RootState {
  return {
    schemaVersion: SCHEMA_VERSION,
    sessions: [],
    settings: { ...defaultSettings }
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeSavedTabs(input: unknown): SavedTab[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.flatMap((rawTab, index) => {
    if (!isObject(rawTab) || typeof rawTab.url !== "string") {
      return [];
    }

    return [
      {
        id: typeof rawTab.id === "string" ? rawTab.id : `migrated-tab-${index}`,
        title:
          typeof rawTab.title === "string" && rawTab.title.trim() ? rawTab.title.trim() : rawTab.url,
        url: rawTab.url,
        favIconUrl: typeof rawTab.favIconUrl === "string" ? rawTab.favIconUrl : null,
        createdAt:
          typeof rawTab.createdAt === "string" ? rawTab.createdAt : new Date().toISOString(),
        lastOpenedAt:
          typeof rawTab.lastOpenedAt === "string" ? rawTab.lastOpenedAt : null,
        originalIndex: typeof rawTab.originalIndex === "number" ? rawTab.originalIndex : index
      }
    ];
  });
}

function normalizeSessions(input: unknown): SessionGroup[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.flatMap((rawSession, index) => {
    if (!isObject(rawSession)) {
      return [];
    }

    const tabs = normalizeSavedTabs(rawSession.tabs);
    const createdAt =
      typeof rawSession.createdAt === "string" ? rawSession.createdAt : new Date().toISOString();
    const updatedAt =
      typeof rawSession.updatedAt === "string" ? rawSession.updatedAt : createdAt;

    return [
      {
        id: typeof rawSession.id === "string" ? rawSession.id : `migrated-session-${index}`,
        title:
          typeof rawSession.title === "string" && rawSession.title.trim()
            ? rawSession.title.trim()
            : `Imported Session ${index + 1}`,
        createdAt,
        updatedAt,
        trashedAt: typeof rawSession.trashedAt === "string" ? rawSession.trashedAt : null,
        sortOrder:
          typeof rawSession.sortOrder === "number" ? rawSession.sortOrder : Date.parse(updatedAt),
        tabCount: tabs.length,
        pinned: Boolean(rawSession.pinned),
        sourceWindowId: typeof rawSession.sourceWindowId === "number" ? rawSession.sourceWindowId : null,
        tabs
      }
    ];
  });
}

export function migrateRootState(input: unknown): RootState {
  if (!isObject(input)) {
    return createDefaultRootState();
  }

  const schemaVersion =
    typeof input.schemaVersion === "number" ? input.schemaVersion : SCHEMA_VERSION;

  const sessions = normalizeSessions(input.sessions);
  const settings: ExtensionSettings = isObject(input.settings)
    ? {
        restoreBehavior:
          input.settings.restoreBehavior === "keep-group" ? "keep-group" : "remove-group",
        defaultClickAction:
          input.settings.defaultClickAction === "open-manager"
            ? "open-manager"
            : "capture-current-window",
        showCaptureFeedback:
          typeof input.settings.showCaptureFeedback === "boolean"
            ? input.settings.showCaptureFeedback
            : true,
        enableContextMenu:
          typeof input.settings.enableContextMenu === "boolean"
            ? input.settings.enableContextMenu
            : true,
        managerGridDensityPreference:
          input.settings.managerGridDensityPreference === "compact" ? "compact" : "enhanced"
      }
    : { ...defaultSettings };

  return {
    schemaVersion,
    sessions,
    settings
  };
}
