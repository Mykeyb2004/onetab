import { chromeLocalStorage, chromeStorageLocalArea } from "../../adapters/chrome/storage";
import { browserDirectoryHandleStore } from "../../storage/file-system/directory-handle-store";
import {
  createDirectoryBackedStorage,
  getStoredDirectoryAccessState,
  readRootStateRecordFromDirectoryHandle,
  requestDirectoryAccess,
  writeRootStateRecordToDirectoryHandle
} from "../../storage/file-system/repository";
import type {
  DirectoryHandleLike,
  DirectoryHandleStore
} from "../../storage/file-system/types";
import { readRootState, writeRootState, type ExtensionStorageArea } from "../../storage/local/repository";
import { ROOT_STORAGE_KEY } from "../../storage/local/schema";
import {
  createChromeLocalRootStateStorageConfig,
  createDirectoryRootStateStorageConfig,
  readRootStateStorageConfig,
  touchRootStateStorageConfig,
  writeRootStateStorageConfig,
  type RootStateStorageBackend
} from "../../storage/root-state/config";

export type PersistenceDirectoryStatus =
  | "browser-local"
  | "directory-ready"
  | "directory-needs-access"
  | "unsupported";

export interface PersistenceDirectoryState {
  backend: RootStateStorageBackend;
  directoryName: string | null;
  fileName: string;
  status: PersistenceDirectoryStatus;
}

interface PersistenceDirectoryDependencies<
  TDirectoryHandle extends DirectoryHandleLike = FileSystemDirectoryHandle
> {
  activeStorage: ExtensionStorageArea;
  localStorageArea: ExtensionStorageArea;
  handleStore: DirectoryHandleStore<TDirectoryHandle>;
  now: () => Date;
  pickDirectory: () => Promise<TDirectoryHandle>;
  isDirectoryPickerSupported: () => boolean;
}

const defaultDependencies: PersistenceDirectoryDependencies = {
  activeStorage: chromeLocalStorage,
  localStorageArea: chromeStorageLocalArea,
  handleStore: browserDirectoryHandleStore,
  now: () => new Date(),
  pickDirectory: () =>
    window.showDirectoryPicker({
      id: "tabvault-persistence-directory",
      mode: "readwrite"
    }),
  isDirectoryPickerSupported: () => typeof window.showDirectoryPicker === "function"
};

export async function loadPersistenceDirectoryState<
  TDirectoryHandle extends DirectoryHandleLike
>(
  dependencies: Partial<PersistenceDirectoryDependencies<TDirectoryHandle>> = {}
): Promise<PersistenceDirectoryState> {
  const resolvedDependencies = {
    ...defaultDependencies,
    ...dependencies
  } as PersistenceDirectoryDependencies<TDirectoryHandle>;
  const config = await readRootStateStorageConfig(resolvedDependencies.localStorageArea);

  if (!resolvedDependencies.isDirectoryPickerSupported()) {
    return {
      backend: config.backend,
      directoryName: config.backend === "directory" ? config.directoryName : null,
      fileName: config.fileName,
      status: "unsupported"
    };
  }

  if (config.backend !== "directory") {
    return {
      backend: config.backend,
      directoryName: null,
      fileName: config.fileName,
      status: "browser-local"
    };
  }

  const accessState = await getStoredDirectoryAccessState(resolvedDependencies.handleStore);

  return {
    backend: config.backend,
    directoryName: config.directoryName,
    fileName: config.fileName,
    status: accessState === "granted" ? "directory-ready" : "directory-needs-access"
  };
}

export async function choosePersistenceDirectory<
  TDirectoryHandle extends DirectoryHandleLike
>(
  dependencies: Partial<PersistenceDirectoryDependencies<TDirectoryHandle>> = {}
): Promise<PersistenceDirectoryState> {
  const resolvedDependencies = {
    ...defaultDependencies,
    ...dependencies
  } as PersistenceDirectoryDependencies<TDirectoryHandle>;

  if (!resolvedDependencies.isDirectoryPickerSupported()) {
    throw new Error("This browser does not support choosing a persistent data directory.");
  }

  const currentConfig = await readRootStateStorageConfig(resolvedDependencies.localStorageArea);
  const selectedDirectoryHandle = await resolvedDependencies.pickDirectory();
  const directoryHandle = await requestDirectoryAccess(selectedDirectoryHandle);
  const now = resolvedDependencies.now();
  const existingDirectoryState = await readRootStateRecordFromDirectoryHandle(directoryHandle);

  if (existingDirectoryState === undefined) {
    const currentState = await readRootState(resolvedDependencies.activeStorage);
    await writeRootStateRecordToDirectoryHandle(directoryHandle, currentState);
  }

  await resolvedDependencies.handleStore.setDirectoryHandle(directoryHandle);

  const nextConfig = touchRootStateStorageConfig(
    createDirectoryRootStateStorageConfig(
      directoryHandle.name,
      currentConfig.syncRevision,
      now
    ),
    now
  );

  await writeRootStateStorageConfig(resolvedDependencies.localStorageArea, nextConfig);
  await resolvedDependencies.localStorageArea.remove(ROOT_STORAGE_KEY);

  return {
    backend: nextConfig.backend,
    directoryName: directoryHandle.name,
    fileName: nextConfig.fileName,
    status: "directory-ready"
  };
}

export async function clearPersistenceDirectory<
  TDirectoryHandle extends DirectoryHandleLike
>(
  dependencies: Partial<PersistenceDirectoryDependencies<TDirectoryHandle>> = {}
): Promise<PersistenceDirectoryState> {
  const resolvedDependencies = {
    ...defaultDependencies,
    ...dependencies
  } as PersistenceDirectoryDependencies<TDirectoryHandle>;
  const currentState = await readRootState(resolvedDependencies.activeStorage);
  const currentConfig = await readRootStateStorageConfig(resolvedDependencies.localStorageArea);
  const now = resolvedDependencies.now();

  await writeRootState(resolvedDependencies.localStorageArea, currentState);
  await resolvedDependencies.handleStore.clearDirectoryHandle();

  const nextConfig = touchRootStateStorageConfig(
    createChromeLocalRootStateStorageConfig(
      currentConfig.syncRevision,
      now
    ),
    now
  );

  await writeRootStateStorageConfig(resolvedDependencies.localStorageArea, nextConfig);

  return {
    backend: nextConfig.backend,
    directoryName: null,
    fileName: nextConfig.fileName,
    status: "browser-local"
  };
}

export function createDirectoryStorageForTesting<
  TDirectoryHandle extends DirectoryHandleLike
>(handleStore: DirectoryHandleStore<TDirectoryHandle>): ExtensionStorageArea {
  return createDirectoryBackedStorage(handleStore);
}
