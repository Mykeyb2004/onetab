import type { ExtensionSettings } from "./settings";
import type { SessionGroup } from "./session";

export type ExportFormat = "json" | "text";

export interface ExportArtifact {
  fileName: string;
  content: string;
  mimeType: string;
}

export interface ExportPayload {
  schemaVersion: number;
  exportedAt: string;
  sessions: SessionGroup[];
  settings?: ExtensionSettings;
}

export interface ImportResult {
  ok: boolean;
  message: string;
  importedGroupCount: number;
  skippedCount: number;
}
