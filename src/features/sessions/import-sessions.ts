import { chromeLocalStorage } from "../../adapters/chrome/storage";
import { createSessionGroup } from "../../domain/sessions/create-session-group";
import { formatSessionTitle } from "../../domain/sessions/format-session-title";
import { isSupportedTabUrl } from "../../domain/tabs/is-supported-tab-url";
import {
  readRootState,
  writeRootState,
  type ExtensionStorageArea
} from "../../storage/local/repository";
import { SCHEMA_VERSION } from "../../storage/local/schema";
import type { ImportResult } from "../../types/import-export";
import type { SessionGroup } from "../../types/session";

interface ImportDependencies {
  storage: ExtensionStorageArea;
  now?: () => Date;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeIsoString(input: unknown, fallback: string): string {
  if (typeof input !== "string") {
    return fallback;
  }

  return Number.isNaN(Date.parse(input)) ? fallback : input;
}

function normalizeImportedSessions(
  sessions: unknown[],
  importedAt: Date
): { sessions: SessionGroup[]; skippedCount: number } {
  const importedAtIso = importedAt.toISOString();
  let skippedCount = 0;

  const normalizedSessions = sessions.flatMap((rawSession, sessionIndex) => {
    if (!isObject(rawSession) || !Array.isArray(rawSession.tabs)) {
      skippedCount += 1;
      return [];
    }

    const normalizedTabs = rawSession.tabs.flatMap((rawTab, tabIndex) => {
      if (!isObject(rawTab) || typeof rawTab.url !== "string" || !isSupportedTabUrl(rawTab.url)) {
        skippedCount += 1;
        return [];
      }

      return [
        {
          id: `tab_import_${importedAt.getTime()}_${sessionIndex}_${tabIndex}`,
          title:
            typeof rawTab.title === "string" && rawTab.title.trim()
              ? rawTab.title.trim()
              : rawTab.url,
          url: rawTab.url,
          favIconUrl: typeof rawTab.favIconUrl === "string" ? rawTab.favIconUrl : null,
          createdAt: normalizeIsoString(rawTab.createdAt, importedAtIso),
          lastOpenedAt:
            typeof rawTab.lastOpenedAt === "string" && !Number.isNaN(Date.parse(rawTab.lastOpenedAt))
              ? rawTab.lastOpenedAt
              : null,
          originalIndex:
            typeof rawTab.originalIndex === "number" ? rawTab.originalIndex : tabIndex
        }
      ];
    });

    if (normalizedTabs.length === 0) {
      skippedCount += 1;
      return [];
    }

    return [
      {
        id: `session_import_${importedAt.getTime()}_${sessionIndex}`,
        title:
          typeof rawSession.title === "string" && rawSession.title.trim()
            ? rawSession.title.trim()
            : formatSessionTitle(importedAt),
        createdAt: normalizeIsoString(rawSession.createdAt, importedAtIso),
        updatedAt: normalizeIsoString(rawSession.updatedAt, importedAtIso),
        trashedAt:
          typeof rawSession.trashedAt === "string" && !Number.isNaN(Date.parse(rawSession.trashedAt))
            ? rawSession.trashedAt
            : null,
        tabCount: normalizedTabs.length,
        pinned: Boolean(rawSession.pinned),
        sourceWindowId: null,
        tabs: normalizedTabs
      }
    ];
  });

  return {
    sessions: normalizedSessions,
    skippedCount
  };
}

export async function importJsonContent(
  content: string,
  dependencies: ImportDependencies = {
    storage: chromeLocalStorage,
    now: () => new Date()
  }
): Promise<ImportResult> {
  let parsedContent: unknown;

  try {
    parsedContent = JSON.parse(content);
  } catch {
    throw new Error("Invalid JSON import file.");
  }

  if (!isObject(parsedContent) || parsedContent.schemaVersion !== SCHEMA_VERSION) {
    throw new Error("Unsupported JSON schema version.");
  }

  if (!Array.isArray(parsedContent.sessions)) {
    throw new Error("JSON import payload does not contain sessions.");
  }

  const now = dependencies.now?.() ?? new Date();
  const normalized = normalizeImportedSessions(parsedContent.sessions, now);

  if (normalized.sessions.length === 0) {
    return {
      ok: true,
      message: "No valid sessions were imported from the JSON file.",
      importedGroupCount: 0,
      skippedCount: normalized.skippedCount
    };
  }

  const state = await readRootState(dependencies.storage);
  await writeRootState(dependencies.storage, {
    ...state,
    sessions: [...normalized.sessions, ...state.sessions]
  });

  return {
    ok: true,
    message: `Imported ${normalized.sessions.length} session group(s) from JSON.`,
    importedGroupCount: normalized.sessions.length,
    skippedCount: normalized.skippedCount
  };
}

export async function importTextContent(
  content: string,
  dependencies: ImportDependencies = {
    storage: chromeLocalStorage,
    now: () => new Date()
  }
): Promise<ImportResult> {
  const now = dependencies.now?.() ?? new Date();
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const validUrls: string[] = [];
  let skippedCount = 0;

  lines.forEach((line) => {
    if (!isSupportedTabUrl(line)) {
      skippedCount += 1;
      return;
    }

    validUrls.push(line);
  });

  if (validUrls.length === 0) {
    return {
      ok: true,
      message: `Skipped ${skippedCount} invalid line(s); no session group was imported.`,
      importedGroupCount: 0,
      skippedCount
    };
  }

  const sessionGroup = createSessionGroup(
    validUrls.map((url, index) => ({
      title: url,
      url,
      index
    })),
    { now }
  );
  const state = await readRootState(dependencies.storage);

  await writeRootState(dependencies.storage, {
    ...state,
    sessions: [sessionGroup, ...state.sessions]
  });

  return {
    ok: true,
    message:
      skippedCount > 0
        ? `Imported 1 session group and skipped ${skippedCount} invalid line(s).`
        : "Imported 1 session group from the text file.",
    importedGroupCount: 1,
    skippedCount
  };
}
