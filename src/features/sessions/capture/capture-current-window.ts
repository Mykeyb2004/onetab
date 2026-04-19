import { captureBrowserTabs, type CaptureDependencies } from "./capture-tabs";

export async function captureCurrentWindow(dependencies: CaptureDependencies) {
  const browserTabs = await dependencies.tabs.listCurrentWindowTabs();
  return captureBrowserTabs(browserTabs, dependencies);
}
