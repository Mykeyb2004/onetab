import type { ExtensionStorageArea } from "../storage/local/repository";

type StorageChangeListener = (
  changes: Record<string, { oldValue?: unknown; newValue?: unknown }>,
  areaName: string
) => void;

export interface PreviewStorageEnvironment {
  storage: ExtensionStorageArea;
  onChanged: {
    addListener(listener: StorageChangeListener): void;
    removeListener(listener: StorageChangeListener): void;
    emit(changes: Record<string, { oldValue?: unknown; newValue?: unknown }>, areaName: string): void;
  };
}

export function createPreviewStorageEnvironment(seedData?: Record<string, unknown>): PreviewStorageEnvironment {
  const data = new Map<string, unknown>(Object.entries(seedData ?? {}));
  const listeners = new Set<StorageChangeListener>();

  async function get(key: string): Promise<Record<string, unknown>> {
    return {
      [key]: data.get(key)
    };
  }

  async function set(items: Record<string, unknown>): Promise<void> {
    const changes: Record<string, { oldValue?: unknown; newValue?: unknown }> = {};

    Object.entries(items).forEach(([key, value]) => {
      const oldValue = data.get(key);
      data.set(key, value);
      changes[key] = {
        oldValue,
        newValue: value
      };
    });

    if (Object.keys(changes).length > 0) {
      listeners.forEach((listener) => listener(changes, "local"));
    }
  }

  async function remove(key: string): Promise<void> {
    const oldValue = data.get(key);
    data.delete(key);

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

  return {
    storage: {
      get,
      set,
      remove
    },
    onChanged: {
      addListener(listener) {
        listeners.add(listener);
      },
      removeListener(listener) {
        listeners.delete(listener);
      },
      emit(changes, areaName) {
        listeners.forEach((listener) => listener(changes, areaName));
      }
    }
  };
}
