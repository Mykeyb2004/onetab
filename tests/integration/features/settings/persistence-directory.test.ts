import { describe, expect, it } from "vitest";
import {
  choosePersistenceDirectory,
  clearPersistenceDirectory,
  createDirectoryStorageForTesting,
  loadPersistenceDirectoryState
} from "../../../../src/features/settings/persistence-directory";
import { writeRootState, readRootState, type ExtensionStorageArea } from "../../../../src/storage/local/repository";
import { createDefaultRootState, ROOT_STORAGE_KEY } from "../../../../src/storage/local/schema";
import {
  createDirectoryRootStateStorageConfig,
  readRootStateStorageConfig,
  writeRootStateStorageConfig
} from "../../../../src/storage/root-state/config";
import {
  readRootStateRecordFromDirectoryHandle,
  writeRootStateRecordToDirectoryHandle
} from "../../../../src/storage/file-system/repository";
import type {
  DirectoryHandleLike,
  DirectoryHandleStore,
  FileHandleLike,
  FileLike,
  WritableFileLike
} from "../../../../src/storage/file-system/types";

function createMemoryStorage(): ExtensionStorageArea {
  const data = new Map<string, unknown>();

  return {
    async get(key) {
      return {
        [key]: data.get(key)
      };
    },
    async set(items) {
      Object.entries(items).forEach(([key, value]) => data.set(key, value));
    },
    async remove(key) {
      data.delete(key);
    }
  };
}

class MemoryFile implements FileLike {
  constructor(private readonly read: () => string) {}

  async text(): Promise<string> {
    return this.read();
  }
}

class MemoryWritableFile implements WritableFileLike {
  private nextValue = "";

  constructor(private readonly commit: (value: string) => void) {}

  async write(data: string): Promise<void> {
    this.nextValue = data;
  }

  async close(): Promise<void> {
    this.commit(this.nextValue);
  }
}

class MemoryFileHandle implements FileHandleLike {
  constructor(
    private readonly fileName: string,
    private readonly files: Map<string, string>
  ) {}

  async getFile(): Promise<FileLike> {
    return new MemoryFile(() => this.files.get(this.fileName) ?? "");
  }

  async createWritable(): Promise<WritableFileLike> {
    return new MemoryWritableFile((value) => {
      this.files.set(this.fileName, value);
    });
  }
}

class MemoryDirectoryHandle implements DirectoryHandleLike {
  readonly files = new Map<string, string>();

  constructor(
    public readonly name: string,
    public permissionState: PermissionState = "granted"
  ) {}

  async queryPermission(): Promise<PermissionState> {
    return this.permissionState;
  }

  async requestPermission(): Promise<PermissionState> {
    return this.permissionState;
  }

  async getFileHandle(name: string, options?: { create?: boolean }): Promise<FileHandleLike> {
    if (!this.files.has(name) && !options?.create) {
      throw {
        name: "NotFoundError"
      };
    }

    if (options?.create && !this.files.has(name)) {
      this.files.set(name, "");
    }

    return new MemoryFileHandle(name, this.files);
  }

  async removeEntry(name: string): Promise<void> {
    if (!this.files.delete(name)) {
      throw {
        name: "NotFoundError"
      };
    }
  }
}

class MemoryDirectoryHandleStore
  implements DirectoryHandleStore<MemoryDirectoryHandle>
{
  constructor(private directoryHandle: MemoryDirectoryHandle | null = null) {}

  async getDirectoryHandle(): Promise<MemoryDirectoryHandle | null> {
    return this.directoryHandle;
  }

  async setDirectoryHandle(handle: MemoryDirectoryHandle): Promise<void> {
    this.directoryHandle = handle;
  }

  async clearDirectoryHandle(): Promise<void> {
    this.directoryHandle = null;
  }
}

describe("persistence directory settings", () => {
  it("should initialize the selected directory from the current root state when the directory has no data file", async () => {
    const localStorage = createMemoryStorage();
    const handleStore = new MemoryDirectoryHandleStore();
    const selectedDirectory = new MemoryDirectoryHandle("TabVault Archive");
    const rootState = createDefaultRootState();
    rootState.settings.enableContextMenu = false;
    rootState.sessions = [
      {
        id: "session-1",
        title: "Saved Tabs",
        createdAt: "2026-04-19T08:00:00.000Z",
        updatedAt: "2026-04-19T08:00:00.000Z",
        trashedAt: null,
        sortOrder: 1,
        tabCount: 1,
        pinned: false,
        sourceWindowId: 3,
        tabs: [
          {
            id: "tab-1",
            title: "Example",
            url: "https://example.com",
            favIconUrl: null,
            createdAt: "2026-04-19T08:00:00.000Z",
            lastOpenedAt: null,
            originalIndex: 0
          }
        ]
      }
    ];

    await writeRootState(localStorage, rootState);

    const result = await choosePersistenceDirectory({
      activeStorage: localStorage,
      localStorageArea: localStorage,
      handleStore,
      isDirectoryPickerSupported: () => true,
      now: () => new Date("2026-04-19T12:00:00.000Z"),
      pickDirectory: async () => selectedDirectory
    });

    const config = await readRootStateStorageConfig(localStorage);
    const persistedState = await readRootStateRecordFromDirectoryHandle(selectedDirectory);
    const localRootState = await localStorage.get(ROOT_STORAGE_KEY);

    expect(result).toEqual({
      backend: "directory",
      directoryName: "TabVault Archive",
      fileName: "tabvault-data.json",
      status: "directory-ready"
    });
    expect(config.backend).toBe("directory");
    expect(config.syncRevision).toBe(1);
    expect(await handleStore.getDirectoryHandle()).toBe(selectedDirectory);
    expect(persistedState).toEqual(rootState);
    expect(localRootState[ROOT_STORAGE_KEY]).toBeUndefined();
  });

  it("should use the selected directory file as the source of truth instead of overwriting it", async () => {
    const localStorage = createMemoryStorage();
    const handleStore = new MemoryDirectoryHandleStore();
    const selectedDirectory = new MemoryDirectoryHandle("Synced Archive");
    const localRootState = createDefaultRootState();
    const directoryRootState = createDefaultRootState();

    localRootState.sessions = [
      {
        id: "session-local",
        title: "Local Tabs",
        createdAt: "2026-04-19T08:00:00.000Z",
        updatedAt: "2026-04-19T08:00:00.000Z",
        trashedAt: null,
        sortOrder: 1,
        tabCount: 1,
        pinned: false,
        sourceWindowId: 1,
        tabs: [
          {
            id: "tab-local",
            title: "Local Example",
            url: "https://local.example.com",
            favIconUrl: null,
            createdAt: "2026-04-19T08:00:00.000Z",
            lastOpenedAt: null,
            originalIndex: 0
          }
        ]
      }
    ];

    directoryRootState.sessions = [
      {
        id: "session-remote",
        title: "Remote Tabs",
        createdAt: "2026-04-19T09:00:00.000Z",
        updatedAt: "2026-04-19T09:00:00.000Z",
        trashedAt: null,
        sortOrder: 2,
        tabCount: 1,
        pinned: true,
        sourceWindowId: 2,
        tabs: [
          {
            id: "tab-remote",
            title: "Remote Example",
            url: "https://remote.example.com",
            favIconUrl: null,
            createdAt: "2026-04-19T09:00:00.000Z",
            lastOpenedAt: null,
            originalIndex: 0
          }
        ]
      }
    ];

    await writeRootState(localStorage, localRootState);
    await writeRootStateRecordToDirectoryHandle(selectedDirectory, directoryRootState);

    await choosePersistenceDirectory({
      activeStorage: localStorage,
      localStorageArea: localStorage,
      handleStore,
      isDirectoryPickerSupported: () => true,
      now: () => new Date("2026-04-19T12:15:00.000Z"),
      pickDirectory: async () => selectedDirectory
    });

    const persistedState = await readRootStateRecordFromDirectoryHandle(selectedDirectory);
    const localStateAfterSwitch = await localStorage.get(ROOT_STORAGE_KEY);

    expect(persistedState).toEqual(directoryRootState);
    expect(localStateAfterSwitch[ROOT_STORAGE_KEY]).toBeUndefined();
  });

  it("should move directory-backed state back into browser local storage when clearing the directory", async () => {
    const localStorage = createMemoryStorage();
    const selectedDirectory = new MemoryDirectoryHandle("TabVault Archive");
    const handleStore = new MemoryDirectoryHandleStore(selectedDirectory);
    const directoryStorage = createDirectoryStorageForTesting(handleStore);
    const rootState = createDefaultRootState();
    rootState.settings.restoreBehavior = "keep-group";
    rootState.sessions = [
      {
        id: "session-2",
        title: "Backlog",
        createdAt: "2026-04-19T09:00:00.000Z",
        updatedAt: "2026-04-19T09:00:00.000Z",
        trashedAt: null,
        sortOrder: 2,
        tabCount: 1,
        pinned: true,
        sourceWindowId: 7,
        tabs: [
          {
            id: "tab-2",
            title: "Docs",
            url: "https://example.com/docs",
            favIconUrl: null,
            createdAt: "2026-04-19T09:00:00.000Z",
            lastOpenedAt: null,
            originalIndex: 0
          }
        ]
      }
    ];

    await writeRootStateRecordToDirectoryHandle(selectedDirectory, rootState);
    await writeRootStateStorageConfig(
      localStorage,
      createDirectoryRootStateStorageConfig("TabVault Archive", 4, new Date("2026-04-19T09:30:00.000Z"))
    );

    const result = await clearPersistenceDirectory({
      activeStorage: directoryStorage,
      localStorageArea: localStorage,
      handleStore,
      isDirectoryPickerSupported: () => true,
      now: () => new Date("2026-04-19T12:30:00.000Z")
    });

    const config = await readRootStateStorageConfig(localStorage);
    const restoredState = await readRootState(localStorage);

    expect(result).toEqual({
      backend: "chrome-local",
      directoryName: null,
      fileName: "tabvault-data.json",
      status: "browser-local"
    });
    expect(config.backend).toBe("chrome-local");
    expect(config.syncRevision).toBe(5);
    expect(await handleStore.getDirectoryHandle()).toBeNull();
    expect(restoredState).toEqual(rootState);
  });

  it("should report that directory access needs to be reconnected when the handle is no longer writable", async () => {
    const localStorage = createMemoryStorage();
    const handleStore = new MemoryDirectoryHandleStore(
      new MemoryDirectoryHandle("TabVault Archive", "prompt")
    );

    await writeRootStateStorageConfig(
      localStorage,
      createDirectoryRootStateStorageConfig("TabVault Archive", 2, new Date("2026-04-19T08:00:00.000Z"))
    );

    const persistenceState = await loadPersistenceDirectoryState({
      localStorageArea: localStorage,
      handleStore,
      isDirectoryPickerSupported: () => true
    });

    expect(persistenceState).toEqual({
      backend: "directory",
      directoryName: "TabVault Archive",
      fileName: "tabvault-data.json",
      status: "directory-needs-access"
    });
  });
});
