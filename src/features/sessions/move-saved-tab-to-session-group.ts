import { chromeLocalStorage } from "../../adapters/chrome/storage";
import {
  repositionSavedTab,
  type RepositionSavedTabDependencies,
  type RepositionSavedTabResult
} from "./reposition-saved-tab";

type MoveSavedTabToSessionGroupDependencies = RepositionSavedTabDependencies;
export type MoveSavedTabToSessionGroupResult = RepositionSavedTabResult;

export async function moveSavedTabToSessionGroup(
  sourceSessionId: string,
  tabId: string,
  targetSessionId: string,
  dependencies: MoveSavedTabToSessionGroupDependencies = {
    storage: chromeLocalStorage,
    now: () => new Date()
  }
): Promise<MoveSavedTabToSessionGroupResult> {
  return repositionSavedTab(sourceSessionId, tabId, targetSessionId, {}, dependencies);
}
