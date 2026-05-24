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

interface ImportedSessionCollection {
  sessions: SessionGroup[];
  skippedCount: number;
}

interface ImportedSpdLink {
  favicon: string | null;
  title: string | null;
  url: string;
}

interface DuplicateFilterResult {
  duplicateUrlCount: number;
  sessions: SessionGroup[];
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

function normalizeComparableUrl(url: string): string {
  return new URL(url).href;
}

function collectPinnedSessionUrls(sessionGroups: SessionGroup[]): Set<string> {
  const pinnedSessionUrls = new Set<string>();

  sessionGroups.forEach((sessionGroup) => {
    if (sessionGroup.trashedAt || !sessionGroup.pinned) {
      return;
    }

    sessionGroup.tabs.forEach((savedTab) => {
      pinnedSessionUrls.add(normalizeComparableUrl(savedTab.url));
    });
  });

  return pinnedSessionUrls;
}

function filterImportedSessionsAgainstPinnedUrls(
  sessionGroups: SessionGroup[],
  pinnedSessionUrls: Set<string>
): DuplicateFilterResult {
  let duplicateUrlCount = 0;

  const sessions = sessionGroups.flatMap((sessionGroup) => {
    const tabs = sessionGroup.tabs.filter((savedTab) => {
      if (!pinnedSessionUrls.has(normalizeComparableUrl(savedTab.url))) {
        return true;
      }

      duplicateUrlCount += 1;
      return false;
    });

    if (tabs.length === 0) {
      return [];
    }

    return [
      {
        ...sessionGroup,
        tabCount: tabs.length,
        tabs
      }
    ];
  });

  return {
    duplicateUrlCount,
    sessions
  };
}

function buildImportMessage(
  sourceLabel: "JSON" | "SPD" | "text",
  importedGroupCount: number,
  invalidSkippedCount: number,
  duplicateUrlCount: number
): string {
  if (sourceLabel === "text") {
    if (importedGroupCount === 0) {
      if (invalidSkippedCount > 0 && duplicateUrlCount > 0) {
        return `Skipped ${invalidSkippedCount} invalid line(s) and ${duplicateUrlCount} duplicate URL(s) already saved in pinned groups; no session group was imported.`;
      }

      if (duplicateUrlCount > 0) {
        return `Skipped ${duplicateUrlCount} duplicate URL(s) already saved in pinned groups; no session group was imported.`;
      }

      return `Skipped ${invalidSkippedCount} invalid line(s); no session group was imported.`;
    }

    if (invalidSkippedCount > 0 && duplicateUrlCount > 0) {
      return `Imported 1 session group and skipped ${invalidSkippedCount} invalid line(s) and ${duplicateUrlCount} duplicate URL(s) already saved in pinned groups.`;
    }

    if (duplicateUrlCount > 0) {
      return `Imported 1 session group and skipped ${duplicateUrlCount} duplicate URL(s) already saved in pinned groups.`;
    }

    return invalidSkippedCount > 0
      ? `Imported 1 session group and skipped ${invalidSkippedCount} invalid line(s).`
      : "Imported 1 session group from the text file.";
  }

  const sourceSuffix = sourceLabel === "JSON" ? "from JSON" : "from SPD";

  if (importedGroupCount === 0) {
    if (invalidSkippedCount > 0 && duplicateUrlCount > 0) {
      return `Skipped ${invalidSkippedCount} invalid item(s) and ${duplicateUrlCount} duplicate URL(s) already saved in pinned groups; no session group was imported ${sourceSuffix}.`;
    }

    if (duplicateUrlCount > 0) {
      return `Skipped ${duplicateUrlCount} duplicate URL(s) already saved in pinned groups; no session group was imported ${sourceSuffix}.`;
    }

    return sourceLabel === "JSON"
      ? "No valid sessions were imported from the JSON file."
      : "No valid session groups were imported from the SPD file.";
  }

  if (invalidSkippedCount > 0 && duplicateUrlCount > 0) {
    return `Imported ${importedGroupCount} session group(s) ${sourceSuffix} and skipped ${invalidSkippedCount} invalid item(s) and ${duplicateUrlCount} duplicate URL(s) already saved in pinned groups.`;
  }

  if (duplicateUrlCount > 0) {
    return `Imported ${importedGroupCount} session group(s) ${sourceSuffix} and skipped ${duplicateUrlCount} duplicate URL(s) already saved in pinned groups.`;
  }

  return sourceLabel === "JSON"
    ? `Imported ${importedGroupCount} session group(s) from JSON.`
    : `Imported ${importedGroupCount} session group(s) from SPD.`;
}

function normalizeImportedSessions(
  sessions: unknown[],
  importedAt: Date
): ImportedSessionCollection {
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

function normalizeImportedSpdSessions(
  categories: unknown[],
  links: unknown[],
  importedAt: Date
): ImportedSessionCollection {
  const importedAtIso = importedAt.toISOString();
  const importedAtSeed = importedAt.getTime();
  let skippedCount = 0;

  const normalizedCategories = categories.flatMap((rawCategory, categoryIndex) => {
    if (!isObject(rawCategory) || (typeof rawCategory.id !== "number" && typeof rawCategory.id !== "string")) {
      skippedCount += 1;
      return [];
    }

    return [
      {
        id: String(rawCategory.id),
        index: categoryIndex,
        title:
          typeof rawCategory.name === "string" && rawCategory.name.trim()
            ? rawCategory.name.trim()
            : `Imported SPD Group ${categoryIndex + 1}`
      }
    ];
  });

  const linksByCategoryId = new Map<string, ImportedSpdLink[]>(
    normalizedCategories.map((category) => [category.id, []])
  );

  links.forEach((rawLink) => {
    if (
      !isObject(rawLink) ||
      typeof rawLink.url !== "string" ||
      !isSupportedTabUrl(rawLink.url) ||
      (typeof rawLink.category !== "number" && typeof rawLink.category !== "string")
    ) {
      skippedCount += 1;
      return;
    }

    const categoryLinks = linksByCategoryId.get(String(rawLink.category));

    if (!categoryLinks) {
      skippedCount += 1;
      return;
    }

    categoryLinks.push({
      favicon:
        typeof rawLink.favicon === "string" && rawLink.favicon.trim() ? rawLink.favicon : null,
      title: typeof rawLink.title === "string" && rawLink.title.trim() ? rawLink.title.trim() : null,
      url: rawLink.url
    });
  });

  const sessions = normalizedCategories.flatMap((category) => {
    const categoryLinks = linksByCategoryId.get(category.id) ?? [];

    if (categoryLinks.length === 0) {
      skippedCount += 1;
      return [];
    }

    const tabs = categoryLinks.map((rawLink, tabIndex) => ({
      id: `tab_spd_import_${importedAtSeed}_${category.index}_${tabIndex}`,
      title: rawLink.title ?? rawLink.url,
      url: rawLink.url,
      favIconUrl: rawLink.favicon,
      createdAt: importedAtIso,
      lastOpenedAt: null,
      originalIndex: tabIndex
    }));

    return [
      {
        id: `session_spd_import_${importedAtSeed}_${category.index}`,
        title: category.title,
        createdAt: importedAtIso,
        updatedAt: importedAtIso,
        trashedAt: null,
        sortOrder: category.index,
        tabCount: tabs.length,
        pinned: false,
        sourceWindowId: null,
        tabs
      }
    ];
  });

  return {
    sessions,
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
  const state = await readRootState(dependencies.storage);
  const filtered = filterImportedSessionsAgainstPinnedUrls(
    normalized.sessions,
    collectPinnedSessionUrls(state.sessions)
  );
  const skippedCount = normalized.skippedCount + filtered.duplicateUrlCount;

  if (filtered.sessions.length === 0) {
    return {
      ok: true,
      message: buildImportMessage("JSON", 0, normalized.skippedCount, filtered.duplicateUrlCount),
      importedGroupCount: 0,
      skippedCount
    };
  }

  await writeRootState(dependencies.storage, {
    ...state,
    sessions: [...filtered.sessions, ...state.sessions]
  });

  return {
    ok: true,
    message: buildImportMessage(
      "JSON",
      filtered.sessions.length,
      normalized.skippedCount,
      filtered.duplicateUrlCount
    ),
    importedGroupCount: filtered.sessions.length,
    skippedCount
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

  const state = await readRootState(dependencies.storage);
  const pinnedSessionUrls = collectPinnedSessionUrls(state.sessions);
  let duplicateUrlCount = 0;
  const deduplicatedUrls = validUrls.filter((url) => {
    if (!pinnedSessionUrls.has(normalizeComparableUrl(url))) {
      return true;
    }

    duplicateUrlCount += 1;
    return false;
  });
  const skippedCountTotal = skippedCount + duplicateUrlCount;

  if (deduplicatedUrls.length === 0) {
    return {
      ok: true,
      message: buildImportMessage("text", 0, skippedCount, duplicateUrlCount),
      importedGroupCount: 0,
      skippedCount: skippedCountTotal
    };
  }

  const sessionGroup = createSessionGroup(
    deduplicatedUrls.map((url, index) => ({
      title: url,
      url,
      index
    })),
    { now }
  );

  await writeRootState(dependencies.storage, {
    ...state,
    sessions: [sessionGroup, ...state.sessions]
  });

  return {
    ok: true,
    message: buildImportMessage("text", 1, skippedCount, duplicateUrlCount),
    importedGroupCount: 1,
    skippedCount: skippedCountTotal
  };
}

export async function importSpdContent(
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
    throw new Error("Invalid SPD import file.");
  }

  if (!isObject(parsedContent) || !Array.isArray(parsedContent.categories) || !Array.isArray(parsedContent.links)) {
    throw new Error("SPD import payload does not contain categories and links.");
  }

  const now = dependencies.now?.() ?? new Date();
  const normalized = normalizeImportedSpdSessions(parsedContent.categories, parsedContent.links, now);
  const state = await readRootState(dependencies.storage);
  const filtered = filterImportedSessionsAgainstPinnedUrls(
    normalized.sessions,
    collectPinnedSessionUrls(state.sessions)
  );
  const skippedCount = normalized.skippedCount + filtered.duplicateUrlCount;

  if (filtered.sessions.length === 0) {
    return {
      ok: true,
      message: buildImportMessage("SPD", 0, normalized.skippedCount, filtered.duplicateUrlCount),
      importedGroupCount: 0,
      skippedCount
    };
  }

  await writeRootState(dependencies.storage, {
    ...state,
    sessions: [...filtered.sessions, ...state.sessions]
  });

  return {
    ok: true,
    message: buildImportMessage(
      "SPD",
      filtered.sessions.length,
      normalized.skippedCount,
      filtered.duplicateUrlCount
    ),
    importedGroupCount: filtered.sessions.length,
    skippedCount
  };
}
