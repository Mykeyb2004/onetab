import { seedPreviewData } from "./seed-preview-data";
import { ROOT_STORAGE_KEY } from "../storage/local/schema";
import type { ExtensionStorageArea } from "../storage/local/repository";

type StorageChangeListener = (
  changes: Record<string, { oldValue?: unknown; newValue?: unknown }>,
  areaName: string
) => void;

function readPreviewStorageValue(key: string): unknown {
  const rawValue = window.localStorage.getItem(key);

  if (rawValue === null) {
    return undefined;
  }

  try {
    return JSON.parse(rawValue) as unknown;
  } catch {
    return rawValue;
  }
}

function writePreviewStorageValue(key: string, value: unknown): void {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function createPreviewStorageArea(
  listeners: Set<StorageChangeListener>
): ExtensionStorageArea {
  return {
    async get(key) {
      return {
        [key]: readPreviewStorageValue(key)
      };
    },
    async set(items) {
      const changes: Record<string, { oldValue?: unknown; newValue?: unknown }> = {};

      Object.entries(items).forEach(([key, value]) => {
        const oldValue = readPreviewStorageValue(key);
        writePreviewStorageValue(key, value);
        changes[key] = {
          oldValue,
          newValue: value
        };
      });

      if (Object.keys(changes).length > 0) {
        listeners.forEach((listener) => listener(changes, "local"));
      }
    },
    async remove(key) {
      const oldValue = readPreviewStorageValue(key);
      window.localStorage.removeItem(key);
      listeners.forEach((listener) =>
        listener(
          {
            [key]: {
              oldValue,
              newValue: undefined
            }
          },
          "local"
        )
      );
    }
  };
}

function createChromeRuntimeShim() {
  return {
    getURL(path: string) {
      return new URL(path, window.location.href).toString();
    },
    async openOptionsPage() {
      return undefined;
    },
    async sendMessage(message: { type: string }) {
      return {
        ok: true,
        message: `Preview received ${message.type}.`
      };
    }
  };
}

function createChromeTabsShim() {
  let nextTabId = 1000;

  return {
    async create({ url }: { url: string }) {
      void url;
      return { id: nextTabId++ };
    },
    async getCurrent() {
      return {
        id: 1
      };
    },
    async update(tabId: number, { url }: { url: string }) {
      void tabId;
      void url;
      return { id: tabId, url };
    },
    async query(queryInfo: Record<string, unknown> = {}) {
      void queryInfo;
      return [];
    },
    async remove() {
      return undefined;
    }
  };
}

function createChromeWindowsShim() {
  let nextWindowId = 2000;

  return {
    async create({ url }: { url: string | string[] }) {
      void url;
      return { id: nextWindowId++ };
    }
  };
}

export async function installPreviewChromeShim(spdContent: string): Promise<void> {
  const listeners = new Set<StorageChangeListener>();
  const storage = createPreviewStorageArea(listeners);

  if (window.localStorage.getItem(ROOT_STORAGE_KEY) === null) {
    await seedPreviewData(storage, spdContent);
  }

  const chromeShim = {
    runtime: createChromeRuntimeShim(),
    storage: {
      local: storage,
      onChanged: {
        addListener(listener: StorageChangeListener) {
          listeners.add(listener);
        },
        removeListener(listener: StorageChangeListener) {
          listeners.delete(listener);
        }
      }
    },
    tabs: createChromeTabsShim(),
    windows: createChromeWindowsShim(),
    action: {
      async setPopup() {
        return undefined;
      }
    },
    contextMenus: {
      async create() {
        return undefined;
      },
      async removeAll() {
        return undefined;
      },
      onClicked: {
        addListener() {
          return undefined;
        },
        removeListener() {
          return undefined;
        }
      }
    },
    commands: {
      onCommand: {
        addListener() {
          return undefined;
        },
        removeListener() {
          return undefined;
        }
      }
    },
    notifications: {
      async create() {
        return undefined;
      }
    }
  };

  Object.assign(globalThis.chrome ?? {}, chromeShim);
}
