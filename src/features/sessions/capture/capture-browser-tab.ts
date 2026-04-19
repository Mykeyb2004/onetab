import type { BrowserTab } from "../../../types/browser";
import { captureBrowserTabs, type CaptureDependencies } from "./capture-tabs";

export async function captureBrowserTab(
  browserTab: BrowserTab | null,
  dependencies: CaptureDependencies
) {
  return captureBrowserTabs(browserTab ? [browserTab] : [], dependencies);
}
