import { chromeLocalStorage } from "../../adapters/chrome/storage";
import { repositionSavedTabInSessionGroups } from "../../domain/sessions/reposition-saved-tab";
import {
  readRootState,
  writeRootState,
  type ExtensionStorageArea
} from "../../storage/local/repository";

export interface RepositionSavedTabOptions {
  targetTabId?: string | null;
}

export interface RepositionSavedTabDependencies {
  storage: ExtensionStorageArea;
  now?: () => Date;
}

export interface RepositionSavedTabResult {
  ok: boolean;
  changed: boolean;
  message: string;
}

export async function repositionSavedTab(
  sourceSessionId: string,
  tabId: string,
  targetSessionId: string,
  options: RepositionSavedTabOptions = {},
  dependencies: RepositionSavedTabDependencies = {
    storage: chromeLocalStorage,
    now: () => new Date()
  }
): Promise<RepositionSavedTabResult> {
  const state = await readRootState(dependencies.storage);
  const updatedAt = (dependencies.now?.() ?? new Date()).toISOString();
  const result = repositionSavedTabInSessionGroups(state.sessions, {
    sourceSessionId,
    tabId,
    targetSessionId,
    targetTabId: options.targetTabId,
    updatedAt
  });

  if (!result.ok) {
    return {
      ok: false,
      changed: false,
      message: result.message
    };
  }

  if (!result.changed) {
    return {
      ok: true,
      changed: false,
      message: "记录顺序未发生变化。"
    };
  }

  await writeRootState(dependencies.storage, {
    ...state,
    sessions: result.sessions
  });

  return {
    ok: true,
    changed: true,
    message:
      result.kind === "reordered-within-session"
        ? "已更新组内记录顺序。"
        : `已将“${result.movedTabTitle}”移动到“${result.targetSessionTitle}”。`
  };
}
