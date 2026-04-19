import type { ExtensionSettings } from "../../types/settings";
import type { SessionGroup } from "../../types/session";

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
  enableContextMenu: true
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

export function migrateRootState(input: unknown): RootState {
  if (!isObject(input)) {
    return createDefaultRootState();
  }

  const schemaVersion =
    typeof input.schemaVersion === "number" ? input.schemaVersion : SCHEMA_VERSION;

  const sessions = Array.isArray(input.sessions) ? (input.sessions as SessionGroup[]) : [];
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
            : true
      }
    : { ...defaultSettings };

  return {
    schemaVersion,
    sessions,
    settings
  };
}
