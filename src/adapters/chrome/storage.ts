import { browserDirectoryHandleStore } from "../../storage/file-system/directory-handle-store";
import { createDirectoryBackedStorage } from "../../storage/file-system/repository";
import type { ExtensionStorageArea } from "../../storage/local/repository";
import {
  bootstrapRootStateStorageConfig,
  readRootStateStorageConfig,
  touchRootStateStorageConfig,
  writeRootStateStorageConfig
} from "../../storage/root-state/config";

export const chromeStorageLocalArea: ExtensionStorageArea = {
  async get(key) {
    return chrome.storage.local.get(key);
  },
  async set(items) {
    await chrome.storage.local.set(items);
  },
  async remove(key) {
    await chrome.storage.local.remove(key);
  }
};

const directoryBackedStorage = createDirectoryBackedStorage(browserDirectoryHandleStore);

async function resolveActiveStorageArea(): Promise<ExtensionStorageArea> {
  const config = await readRootStateStorageConfig(chromeStorageLocalArea);
  return config.backend === "directory" ? directoryBackedStorage : chromeStorageLocalArea;
}

async function touchActiveStorageConfig(): Promise<void> {
  const config = await bootstrapRootStateStorageConfig(chromeStorageLocalArea);
  await writeRootStateStorageConfig(
    chromeStorageLocalArea,
    touchRootStateStorageConfig(config)
  );
}

export const chromeLocalStorage: ExtensionStorageArea = {
  async get(key) {
    const activeStorage = await resolveActiveStorageArea();
    return activeStorage.get(key);
  },
  async set(items) {
    const activeStorage = await resolveActiveStorageArea();
    await activeStorage.set(items);
    await touchActiveStorageConfig();
  },
  async remove(key) {
    const activeStorage = await resolveActiveStorageArea();
    await activeStorage.remove(key);
    await touchActiveStorageConfig();
  }
};
