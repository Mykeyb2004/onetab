import type { BrowserTab } from "../../../types/browser";
import type { CaptureDependencies, CaptureResult } from "./capture-tabs";
import { captureBrowserTabToDefaultNotesGroup } from "./capture-browser-tab-to-default-notes-group";

export async function captureBrowserTab(
  browserTab: BrowserTab | null,
  dependencies: CaptureDependencies
): Promise<CaptureResult> {
  return captureBrowserTabToDefaultNotesGroup(browserTab, dependencies);
}
