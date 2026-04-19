import type { ExtensionSettings } from "../../types/settings";
import type { SessionGroup } from "../../types/session";
import {
  createDefaultRootState,
  migrateRootState,
  ROOT_STORAGE_KEY,
  type RootState
} from "./schema";

export interface ExtensionStorageArea {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(key: string): Promise<void>;
}

export async function readRootState(storage: ExtensionStorageArea): Promise<RootState> {
  const result = await storage.get(ROOT_STORAGE_KEY);
  return migrateRootState(result[ROOT_STORAGE_KEY]);
}

export async function writeRootState(
  storage: ExtensionStorageArea,
  state: RootState
): Promise<void> {
  await storage.set({
    [ROOT_STORAGE_KEY]: state
  });
}

export async function bootstrapRootState(storage: ExtensionStorageArea): Promise<RootState> {
  const state = await readRootState(storage);

  if (state.sessions.length === 0 && state.schemaVersion === createDefaultRootState().schemaVersion) {
    await writeRootState(storage, state);
  }

  return state;
}

export async function appendSessionGroup(
  storage: ExtensionStorageArea,
  group: SessionGroup
): Promise<RootState> {
  const state = await readRootState(storage);
  const nextState: RootState = {
    ...state,
    sessions: [group, ...state.sessions]
  };

  await writeRootState(storage, nextState);
  return nextState;
}

export async function updateSettings(
  storage: ExtensionStorageArea,
  patch: Partial<ExtensionSettings>
): Promise<RootState> {
  const state = await readRootState(storage);
  const nextState: RootState = {
    ...state,
    settings: {
      ...state.settings,
      ...patch
    }
  };

  await writeRootState(storage, nextState);
  return nextState;
}
