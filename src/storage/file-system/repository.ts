import type { ExtensionStorageArea } from "../local/repository";
import { ROOT_STORAGE_KEY } from "../local/schema";
import { ROOT_STATE_FILE_NAME } from "../root-state/config";
import type {
  DirectoryHandleLike,
  DirectoryHandleStore,
  FileHandleLike,
  PermissionMode
} from "./types";

const DIRECTORY_ACCESS_ERROR_MESSAGE =
  "TabVault cannot access the configured data directory. Re-choose it in Settings.";

function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    typeof error.name === "string" &&
    error.name === "NotFoundError"
  );
}

async function ensureDirectoryPermission<TDirectoryHandle extends DirectoryHandleLike>(
  directoryHandle: TDirectoryHandle,
  mode: PermissionMode,
  allowPrompt: boolean
): Promise<PermissionState> {
  const permission = await directoryHandle.queryPermission({ mode });

  if (permission === "granted" || !allowPrompt || !directoryHandle.requestPermission) {
    return permission;
  }

  return directoryHandle.requestPermission({ mode });
}

async function requireDirectoryHandle<TDirectoryHandle extends DirectoryHandleLike>(
  handleStore: DirectoryHandleStore<TDirectoryHandle>,
  mode: PermissionMode,
  allowPrompt = false
): Promise<TDirectoryHandle> {
  const directoryHandle = await handleStore.getDirectoryHandle();

  if (!directoryHandle) {
    throw new Error(DIRECTORY_ACCESS_ERROR_MESSAGE);
  }

  const permission = await ensureDirectoryPermission(directoryHandle, mode, allowPrompt);

  if (permission !== "granted") {
    throw new Error(DIRECTORY_ACCESS_ERROR_MESSAGE);
  }

  return directoryHandle;
}

async function readDirectoryFile(
  directoryHandle: DirectoryHandleLike,
  fileName: string
): Promise<FileHandleLike | null> {
  try {
    return await directoryHandle.getFileHandle(fileName);
  } catch (error: unknown) {
    if (isNotFoundError(error)) {
      return null;
    }

    throw error;
  }
}

export async function readRootStateRecordFromDirectoryHandle(
  directoryHandle: DirectoryHandleLike,
  fileName = ROOT_STATE_FILE_NAME
): Promise<unknown> {
  const fileHandle = await readDirectoryFile(directoryHandle, fileName);

  if (!fileHandle) {
    return undefined;
  }

  const file = await fileHandle.getFile();
  const text = await file.text();

  if (!text.trim()) {
    return undefined;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`Failed to parse persisted TabVault data from ${fileName}.`);
  }
}

export async function writeRootStateRecordToDirectoryHandle(
  directoryHandle: DirectoryHandleLike,
  value: unknown,
  fileName = ROOT_STATE_FILE_NAME
): Promise<void> {
  const fileHandle = await directoryHandle.getFileHandle(fileName, {
    create: true
  });
  const writable = await fileHandle.createWritable();

  await writable.write(`${JSON.stringify(value, null, 2)}\n`);
  await writable.close();
}

export async function removeRootStateRecordFromDirectoryHandle(
  directoryHandle: DirectoryHandleLike,
  fileName = ROOT_STATE_FILE_NAME
): Promise<void> {
  if (!directoryHandle.removeEntry) {
    return;
  }

  try {
    await directoryHandle.removeEntry(fileName);
  } catch (error: unknown) {
    if (!isNotFoundError(error)) {
      throw error;
    }
  }
}

export async function getStoredDirectoryAccessState<
  TDirectoryHandle extends DirectoryHandleLike
>(handleStore: DirectoryHandleStore<TDirectoryHandle>): Promise<"granted" | "missing" | "needs-access"> {
  const directoryHandle = await handleStore.getDirectoryHandle();

  if (!directoryHandle) {
    return "missing";
  }

  const permission = await ensureDirectoryPermission(directoryHandle, "readwrite", false);

  return permission === "granted" ? "granted" : "needs-access";
}

export async function requestDirectoryAccess<
  TDirectoryHandle extends DirectoryHandleLike
>(directoryHandle: TDirectoryHandle): Promise<TDirectoryHandle> {
  const permission = await ensureDirectoryPermission(directoryHandle, "readwrite", true);

  if (permission !== "granted") {
    throw new Error(DIRECTORY_ACCESS_ERROR_MESSAGE);
  }

  return directoryHandle;
}

export function createDirectoryBackedStorage<
  TDirectoryHandle extends DirectoryHandleLike
>(handleStore: DirectoryHandleStore<TDirectoryHandle>): ExtensionStorageArea {
  return {
    async get(key) {
      if (key !== ROOT_STORAGE_KEY) {
        return {
          [key]: undefined
        };
      }

      const directoryHandle = await requireDirectoryHandle(handleStore, "read");
      const value = await readRootStateRecordFromDirectoryHandle(directoryHandle);

      return {
        [key]: value
      };
    },
    async set(items) {
      if (!(ROOT_STORAGE_KEY in items)) {
        return;
      }

      const directoryHandle = await requireDirectoryHandle(handleStore, "readwrite");
      await writeRootStateRecordToDirectoryHandle(directoryHandle, items[ROOT_STORAGE_KEY]);
    },
    async remove(key) {
      if (key !== ROOT_STORAGE_KEY) {
        return;
      }

      const directoryHandle = await requireDirectoryHandle(handleStore, "readwrite");
      await removeRootStateRecordFromDirectoryHandle(directoryHandle);
    }
  };
}
