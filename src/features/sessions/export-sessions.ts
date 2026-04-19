import { chromeLocalStorage } from "../../adapters/chrome/storage";
import { SCHEMA_VERSION } from "../../storage/local/schema";
import { readRootState, type ExtensionStorageArea } from "../../storage/local/repository";
import type { ExportArtifact, ExportFormat, ExportPayload } from "../../types/import-export";
import type { SessionGroup } from "../../types/session";

interface ExportDependencies {
  storage: ExtensionStorageArea;
  now?: () => Date;
}

function formatFileTimestamp(date: Date): string {
  const parts = [
    date.getFullYear(),
    (date.getMonth() + 1).toString().padStart(2, "0"),
    date.getDate().toString().padStart(2, "0")
  ];
  const time = [
    date.getHours().toString().padStart(2, "0"),
    date.getMinutes().toString().padStart(2, "0"),
    date.getSeconds().toString().padStart(2, "0")
  ];

  return `${parts.join("")}-${time.join("")}`;
}

function flattenSessionUrls(sessionGroups: SessionGroup[]): string {
  return sessionGroups.flatMap((sessionGroup) => sessionGroup.tabs.map((savedTab) => savedTab.url)).join("\n");
}

function createJsonArtifact(
  payload: ExportPayload,
  fileNamePrefix: string,
  now: Date
): ExportArtifact {
  return {
    fileName: `${fileNamePrefix}-${formatFileTimestamp(now)}.json`,
    content: JSON.stringify(payload, null, 2),
    mimeType: "application/json"
  };
}

function createTextArtifact(
  sessionGroups: SessionGroup[],
  fileNamePrefix: string,
  now: Date
): ExportArtifact {
  return {
    fileName: `${fileNamePrefix}-${formatFileTimestamp(now)}.txt`,
    content: flattenSessionUrls(sessionGroups),
    mimeType: "text/plain"
  };
}

export async function exportAllSessions(
  format: ExportFormat,
  dependencies: ExportDependencies = {
    storage: chromeLocalStorage,
    now: () => new Date()
  }
): Promise<ExportArtifact> {
  const state = await readRootState(dependencies.storage);
  const now = dependencies.now?.() ?? new Date();

  if (format === "json") {
    return createJsonArtifact(
      {
        schemaVersion: SCHEMA_VERSION,
        exportedAt: now.toISOString(),
        sessions: state.sessions,
        settings: state.settings
      },
      "tabvault-all-sessions",
      now
    );
  }

  return createTextArtifact(state.sessions, "tabvault-all-sessions", now);
}

export async function exportSingleSession(
  sessionId: string,
  format: ExportFormat,
  dependencies: ExportDependencies = {
    storage: chromeLocalStorage,
    now: () => new Date()
  }
): Promise<ExportArtifact> {
  const state = await readRootState(dependencies.storage);
  const sessionGroup = state.sessions.find((session) => session.id === sessionId);

  if (!sessionGroup) {
    throw new Error("Session group not found.");
  }

  const now = dependencies.now?.() ?? new Date();
  const sanitizedTitle = sessionGroup.title.replace(/\s+/g, "-").replace(/[^\w-]/g, "");
  const fileNamePrefix = sanitizedTitle ? `tabvault-${sanitizedTitle}` : "tabvault-session";

  if (format === "json") {
    return createJsonArtifact(
      {
        schemaVersion: SCHEMA_VERSION,
        exportedAt: now.toISOString(),
        sessions: [sessionGroup]
      },
      fileNamePrefix,
      now
    );
  }

  return createTextArtifact([sessionGroup], fileNamePrefix, now);
}
