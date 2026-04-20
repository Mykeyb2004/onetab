import type { DirectoryHandleStore } from "./types";

const DATABASE_NAME = "tabvault-file-system";
const DATABASE_VERSION = 1;
const OBJECT_STORE_NAME = "handles";
const ROOT_DIRECTORY_HANDLE_KEY = "root-state-directory";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(OBJECT_STORE_NAME)) {
        database.createObjectStore(OBJECT_STORE_NAME);
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error ?? new Error("Failed to open the TabVault directory handle database."));
    };
  });
}

function runTransaction<T>(
  mode: IDBTransactionMode,
  execute: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDatabase().then(
    (database) =>
      new Promise((resolve, reject) => {
        const transaction = database.transaction(OBJECT_STORE_NAME, mode);
        const store = transaction.objectStore(OBJECT_STORE_NAME);
        const request = execute(store);
        let result: T;

        request.onsuccess = () => {
          result = request.result;
        };

        transaction.oncomplete = () => {
          database.close();
          resolve(result);
        };

        transaction.onerror = () => {
          database.close();
          reject(transaction.error ?? request.error ?? new Error("IndexedDB transaction failed."));
        };

        transaction.onabort = () => {
          database.close();
          reject(transaction.error ?? new Error("IndexedDB transaction was aborted."));
        };
      })
  );
}

export const browserDirectoryHandleStore: DirectoryHandleStore = {
  async getDirectoryHandle() {
    return runTransaction("readonly", (store) => store.get(ROOT_DIRECTORY_HANDLE_KEY));
  },
  async setDirectoryHandle(handle) {
    await runTransaction("readwrite", (store) => store.put(handle, ROOT_DIRECTORY_HANDLE_KEY));
  },
  async clearDirectoryHandle() {
    await runTransaction("readwrite", (store) => store.delete(ROOT_DIRECTORY_HANDLE_KEY));
  }
};
