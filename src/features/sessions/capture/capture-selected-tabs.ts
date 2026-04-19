import { captureBrowserTabs, type CaptureDependencies } from "./capture-tabs";

export async function captureSelectedTabs(dependencies: CaptureDependencies) {
  const selectedTabs = await dependencies.tabs.listSelectedTabs();
  return captureBrowserTabs(selectedTabs, dependencies);
}
