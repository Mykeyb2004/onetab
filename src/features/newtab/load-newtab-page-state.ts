import { chromeLocalStorage } from "../../adapters/chrome/storage";
import {
  selectNewTabSessionSummaries,
  type NewTabSessionSummaryCollection
} from "../../domain/sessions/select-newtab-session-summaries";
import { readRootState, type ExtensionStorageArea } from "../../storage/local/repository";

export interface LoadNewTabPageStateDependencies {
  storage: ExtensionStorageArea;
  recentLimit?: number;
  previewLimit?: number;
}

export type NewTabPageState = NewTabSessionSummaryCollection;

export async function loadNewTabPageState(
  dependencies: LoadNewTabPageStateDependencies = {
    storage: chromeLocalStorage,
    recentLimit: 4,
    previewLimit: 3
  }
): Promise<NewTabPageState> {
  const state = await readRootState(dependencies.storage);

  return selectNewTabSessionSummaries(state.sessions, {
    recentLimit: dependencies.recentLimit,
    previewLimit: dependencies.previewLimit
  });
}
