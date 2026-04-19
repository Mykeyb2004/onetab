export interface SavedTab {
  id: string;
  title: string;
  url: string;
  favIconUrl: string | null;
  createdAt: string;
  lastOpenedAt: string | null;
  originalIndex: number;
}

export interface SessionGroup {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  trashedAt: string | null;
  tabCount: number;
  pinned: boolean;
  sourceWindowId: number | null;
  tabs: SavedTab[];
}

export interface CapturableTab {
  title?: string;
  url: string;
  favIconUrl?: string;
  index: number;
}
