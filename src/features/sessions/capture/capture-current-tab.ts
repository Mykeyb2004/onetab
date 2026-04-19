import { captureBrowserTabs, type CaptureDependencies } from "./capture-tabs";

export async function captureCurrentTab(dependencies: CaptureDependencies) {
  const activeTab = await dependencies.tabs.getActiveTab();
  return captureBrowserTabs(activeTab ? [activeTab] : [], dependencies);
}
