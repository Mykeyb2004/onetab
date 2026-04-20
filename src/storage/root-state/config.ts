import type { ExtensionStorageArea } from "../local/repository";

export const ROOT_STATE_STORAGE_CONFIG_KEY = "tabvault:root-storage-config";
export const ROOT_STATE_FILE_NAME = "tabvault-data.json";

export type RootStateStorageBackend = "chrome-local" | "directory";

interface RootStateStorageConfigBase {
  backend: RootStateStorageBackend;
  fileName: string;
  syncRevision: number;
  updatedAt: string;
}

export interface ChromeLocalRootStateStorageConfig extends RootStateStorageConfigBase {
  backend: "chrome-local";
}

export interface DirectoryRootStateStorageConfig extends RootStateStorageConfigBase {
  backend: "directory";
  directoryName: string;
}

export type RootStateStorageConfig =
  | ChromeLocalRootStateStorageConfig
  | DirectoryRootStateStorageConfig;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function createChromeLocalRootStateStorageConfig(
  syncRevision = 0,
  now: Date = new Date()
): ChromeLocalRootStateStorageConfig {
  return {
    backend: "chrome-local",
    fileName: ROOT_STATE_FILE_NAME,
    syncRevision,
    updatedAt: now.toISOString()
  };
}

export function createDirectoryRootStateStorageConfig(
  directoryName: string,
  syncRevision = 0,
  now: Date = new Date()
): DirectoryRootStateStorageConfig {
  return {
    backend: "directory",
    directoryName,
    fileName: ROOT_STATE_FILE_NAME,
    syncRevision,
    updatedAt: now.toISOString()
  };
}

export function migrateRootStateStorageConfig(input: unknown): RootStateStorageConfig {
  if (!isObject(input)) {
    return createChromeLocalRootStateStorageConfig();
  }

  const syncRevision =
    typeof input.syncRevision === "number" && input.syncRevision >= 0 ? input.syncRevision : 0;
  const updatedAt =
    typeof input.updatedAt === "string" ? input.updatedAt : new Date().toISOString();
  const fileName =
    typeof input.fileName === "string" && input.fileName.trim()
      ? input.fileName.trim()
      : ROOT_STATE_FILE_NAME;

  if (input.backend === "directory") {
    return {
      backend: "directory",
      directoryName:
        typeof input.directoryName === "string" && input.directoryName.trim()
          ? input.directoryName.trim()
          : "Selected Folder",
      fileName,
      syncRevision,
      updatedAt
    };
  }

  return {
    backend: "chrome-local",
    fileName,
    syncRevision,
    updatedAt
  };
}

export async function readRootStateStorageConfig(
  storage: ExtensionStorageArea
): Promise<RootStateStorageConfig> {
  const result = await storage.get(ROOT_STATE_STORAGE_CONFIG_KEY);
  return migrateRootStateStorageConfig(result[ROOT_STATE_STORAGE_CONFIG_KEY]);
}

export async function bootstrapRootStateStorageConfig(
  storage: ExtensionStorageArea
): Promise<RootStateStorageConfig> {
  const result = await storage.get(ROOT_STATE_STORAGE_CONFIG_KEY);
  const existingConfig = result[ROOT_STATE_STORAGE_CONFIG_KEY];

  if (existingConfig !== undefined) {
    return migrateRootStateStorageConfig(existingConfig);
  }

  const config = createChromeLocalRootStateStorageConfig();
  await writeRootStateStorageConfig(storage, config);
  return config;
}

export async function writeRootStateStorageConfig(
  storage: ExtensionStorageArea,
  config: RootStateStorageConfig
): Promise<void> {
  await storage.set({
    [ROOT_STATE_STORAGE_CONFIG_KEY]: config
  });
}

export function touchRootStateStorageConfig(
  config: RootStateStorageConfig,
  now: Date = new Date()
): RootStateStorageConfig {
  return {
    ...config,
    syncRevision: config.syncRevision + 1,
    updatedAt: now.toISOString()
  };
}
