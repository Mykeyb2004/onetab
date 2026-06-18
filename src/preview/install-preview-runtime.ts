import { installPreviewChromeShim } from "./runtime-shim";

export interface PreviewRuntimeDependencies {
  baseUrl: string;
  fetchSeed: (path: string) => Promise<{ text(): Promise<string> }>;
  globalScope: typeof globalThis;
  locationSearch: string;
  storage: Storage;
}

export interface PreviewRuntimeOptions {
  isDev: boolean;
  chromeLike?: {
    storage?: {
      local?: {
        get?: (key: string) => Promise<Record<string, unknown>>;
      };
    };
  };
}

export function shouldInstallPreviewRuntime(options: PreviewRuntimeOptions): boolean {
  return options.isDev && options.chromeLike?.storage?.local?.get === undefined;
}

export function shouldResetPreviewRuntime(locationSearch: string): boolean {
  return new URLSearchParams(locationSearch).get("reset") === "1";
}

export async function installPreviewRuntime(
  dependencies: PreviewRuntimeDependencies
): Promise<void> {
  const response = await dependencies.fetchSeed("/export20260524.spd");
  const spdContent = await response.text();

  if (shouldResetPreviewRuntime(dependencies.locationSearch)) {
    dependencies.storage.clear();
  }

  await installPreviewChromeShim(spdContent, {
    baseUrl: dependencies.baseUrl,
    globalScope: dependencies.globalScope,
    storage: dependencies.storage
  });
}
