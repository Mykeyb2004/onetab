export interface BrowserTab {
  id: number;
  windowId: number;
  index: number;
  groupId?: number;
  title?: string;
  url?: string;
  favIconUrl?: string;
  active?: boolean;
  highlighted?: boolean;
}

export interface TabsAdapter {
  listCurrentWindowTabs(): Promise<BrowserTab[]>;
  listTabsInWindow(windowId: number): Promise<BrowserTab[]>;
  listAllTabs(): Promise<BrowserTab[]>;
  getActiveTab(): Promise<BrowserTab | null>;
  listSelectedTabs(): Promise<BrowserTab[]>;
  closeTabs(tabIds: number[]): Promise<void>;
}

export interface RestoreTabsAdapter {
  openTabsInNewWindow(urls: string[]): Promise<number | null>;
  openTab(url: string): Promise<number | null>;
}
