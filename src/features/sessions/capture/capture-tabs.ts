import { createSessionGroup } from "../../../domain/sessions/create-session-group";
import { prepareTabsForCapture } from "../../../domain/tabs/prepare-tabs-for-capture";
import { appendSessionGroup, type ExtensionStorageArea } from "../../../storage/local/repository";
import type { BrowserTab, TabsAdapter } from "../../../types/browser";

export interface CaptureResult {
  ok: boolean;
  message: string;
  createdGroupId: string | null;
  capturedCount: number;
  skippedCount: number;
  closedCount: number;
}

export interface CaptureDependencies {
  storage: ExtensionStorageArea;
  tabs: TabsAdapter;
  now?: () => Date;
}

function buildCaptureMessage(result: {
  capturedCount: number;
  skippedCount: number;
  closeFailed: boolean;
}): string {
  if (result.capturedCount === 0) {
    if (result.skippedCount > 0) {
      return `Skipped ${result.skippedCount} unsupported tab(s); nothing was captured.`;
    }

    return "No tabs were available to capture.";
  }

  if (result.closeFailed) {
    return `Saved ${result.capturedCount} tab(s), but failed to close the original tab(s).`;
  }

  if (result.skippedCount > 0) {
    return `Saved ${result.capturedCount} tab(s) and skipped ${result.skippedCount} unsupported tab(s).`;
  }

  return `Saved ${result.capturedCount} tab(s) to TabVault.`;
}

export async function captureBrowserTabs(
  browserTabs: BrowserTab[],
  dependencies: CaptureDependencies
): Promise<CaptureResult> {
  if (browserTabs.length === 0) {
    return {
      ok: true,
      message: buildCaptureMessage({
        capturedCount: 0,
        skippedCount: 0,
        closeFailed: false
      }),
      createdGroupId: null,
      capturedCount: 0,
      skippedCount: 0,
      closedCount: 0
    };
  }

  const preparedTabs = prepareTabsForCapture(browserTabs);

  if (preparedTabs.capturableTabs.length === 0) {
    return {
      ok: true,
      message: buildCaptureMessage({
        capturedCount: 0,
        skippedCount: preparedTabs.skippedTabs.length,
        closeFailed: false
      }),
      createdGroupId: null,
      capturedCount: 0,
      skippedCount: preparedTabs.skippedTabs.length,
      closedCount: 0
    };
  }

  const sessionGroup = createSessionGroup(preparedTabs.capturableTabs, {
    now: dependencies.now?.(),
    sourceWindowId: preparedTabs.sourceWindowId
  });

  await appendSessionGroup(dependencies.storage, sessionGroup);

  let closeFailed = false;

  try {
    await dependencies.tabs.closeTabs(preparedTabs.closableTabIds);
  } catch {
    closeFailed = true;
  }

  return {
    ok: !closeFailed,
    message: buildCaptureMessage({
      capturedCount: preparedTabs.capturableTabs.length,
      skippedCount: preparedTabs.skippedTabs.length,
      closeFailed
    }),
    createdGroupId: sessionGroup.id,
    capturedCount: preparedTabs.capturableTabs.length,
    skippedCount: preparedTabs.skippedTabs.length,
    closedCount: closeFailed ? 0 : preparedTabs.closableTabIds.length
  };
}
