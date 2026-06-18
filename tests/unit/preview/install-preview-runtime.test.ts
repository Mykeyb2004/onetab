import { describe, expect, it } from "vitest";
import {
  installPreviewRuntime,
  shouldInstallPreviewRuntime,
  shouldResetPreviewRuntime
} from "../../../src/preview/install-preview-runtime";
import { ROOT_STORAGE_KEY } from "../../../src/storage/local/schema";

class MemoryLocalStorage implements Storage {
  private readonly data = new Map<string, string>();

  get length(): number {
    return this.data.size;
  }

  clear(): void {
    this.data.clear();
  }

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.data.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

describe("preview runtime installer", () => {
  it("should install preview runtime in dev when chrome storage is unavailable", () => {
    expect(shouldInstallPreviewRuntime({ isDev: true, chromeLike: undefined })).toBe(true);
    expect(
      shouldInstallPreviewRuntime({
        isDev: true,
        chromeLike: {
          storage: {
            local: {
              get: async () => ({})
            }
          }
        }
      })
    ).toBe(false);
    expect(shouldInstallPreviewRuntime({ isDev: false, chromeLike: undefined })).toBe(false);
  });

  it("should detect reset query flag", () => {
    expect(shouldResetPreviewRuntime("?reset=1")).toBe(true);
    expect(shouldResetPreviewRuntime("?reset=0")).toBe(false);
    expect(shouldResetPreviewRuntime("")).toBe(false);
  });

  it("should fetch SPD seed data and install a chrome storage shim", async () => {
    const storage = new MemoryLocalStorage();
    const globalScope = {} as typeof globalThis;
    const spdContent = JSON.stringify({
      categories: [{ id: 1, name: "Saved" }],
      links: [
        {
          category: 1,
          url: "https://example.com",
          title: "Example",
          favicon: null
        }
      ]
    });

    await installPreviewRuntime({
      baseUrl: "http://127.0.0.1:5173/options.html",
      fetchSeed: async (url) => {
        expect(url).toBe("/export20260524.spd");
        return {
          text: async () => spdContent
        };
      },
      globalScope,
      locationSearch: "",
      storage
    });

    const chromeLike = globalScope.chrome as {
      storage: {
        local: {
          get(key: string): Promise<Record<string, unknown>>;
        };
      };
    };
    const rootState = await chromeLike.storage.local.get(ROOT_STORAGE_KEY);

    expect(rootState[ROOT_STORAGE_KEY]).toMatchObject({
      sessions: [
        {
          title: "Saved",
          tabs: [
            {
              title: "Example",
              url: "https://example.com"
            }
          ]
        }
      ]
    });
  });
});
