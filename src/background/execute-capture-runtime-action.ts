import type { NotificationAdapter } from "../adapters/chrome/notifications";
import { chromeLocalStorage } from "../adapters/chrome/storage";
import { readRootState, type ExtensionStorageArea } from "../storage/local/repository";
import type { RuntimeResponse } from "../shared/messages";

export interface RuntimeActionResult {
  ok: boolean;
  message: string;
}

interface ExecuteCaptureRuntimeActionDependencies {
  storage: ExtensionStorageArea;
  notifications: NotificationAdapter;
}

export async function executeCaptureRuntimeAction(
  captureAction: () => Promise<RuntimeActionResult>,
  dependencies: ExecuteCaptureRuntimeActionDependencies
): Promise<RuntimeResponse> {
  const result = await captureAction();
  const state = await readRootState(dependencies.storage);

  if (state.settings.showCaptureFeedback) {
    await dependencies.notifications.showCaptureFeedback(result.message);
  }

  return {
    ok: result.ok,
    message: result.message
  };
}

export const defaultExecuteCaptureRuntimeActionDependencies: ExecuteCaptureRuntimeActionDependencies = {
  storage: chromeLocalStorage,
  notifications: {
    async showCaptureFeedback() {
      // Default notifications dependency is injected in the service worker.
    }
  }
};
