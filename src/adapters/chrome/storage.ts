import type { ExtensionStorageArea } from "../../storage/local/repository";

export const chromeLocalStorage: ExtensionStorageArea = {
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
