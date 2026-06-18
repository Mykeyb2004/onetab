import { installPreviewRuntime, shouldInstallPreviewRuntime } from "./install-preview-runtime";

interface PreviewEntryDependencies {
  baseUrl: string;
  globalScope: typeof globalThis;
}

export async function bootPreviewEntry(
  dependencies: PreviewEntryDependencies,
  renderApp: () => Promise<void>
): Promise<void> {
  const chromeLike = dependencies.globalScope.chrome as
    | {
        storage?: {
          local?: {
            get?: (key: string) => Promise<Record<string, unknown>>;
          };
        };
      }
    | undefined;

  if (shouldInstallPreviewRuntime({ isDev: import.meta.env.DEV, chromeLike })) {
    await installPreviewRuntime({
      baseUrl: dependencies.baseUrl,
      fetchSeed: (path) => fetch(path),
      globalScope: dependencies.globalScope,
      locationSearch: window.location.search,
      storage: window.localStorage
    });
  }

  await renderApp();
}
