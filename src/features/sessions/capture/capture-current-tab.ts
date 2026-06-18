import type { CaptureDependencies, CaptureResult } from "./capture-tabs";
import { captureBrowserTabToDefaultNotesGroup } from "./capture-browser-tab-to-default-notes-group";

export async function captureCurrentTab(
  dependencies: CaptureDependencies
): Promise<CaptureResult> {
  const activeTab = await dependencies.tabs.getActiveTab();
  return captureBrowserTabToDefaultNotesGroup(activeTab, dependencies);
}
