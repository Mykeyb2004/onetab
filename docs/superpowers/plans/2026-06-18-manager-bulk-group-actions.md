# Manager Bulk Group Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add batch selection and batch actions for active and trash session groups in the Manager sidebar.

**Architecture:** Add all-or-nothing feature-layer batch functions that read and write root state once per operation. Add a small Manager toolbar component for the batch action controls, then wire bucket-aware selection state into `ManagerApp` while preserving existing single-group menus and drag behavior outside selection mode.

**Tech Stack:** TypeScript strict mode, Chrome Extension MV3, React, Vite, Vitest, ESLint, GitNexus.

## Global Constraints

- Follow `/Users/zhangqijin/WebstormProjects/onetab/AGENTS.md`.
- Use `npm` scripts from `package.json`; this task does not use Python.
- Do not modify storage schema, storage migration, import/export format, or manifest permissions.
- Do not add new dependencies.
- Do not introduce bare `any`.
- Keep storage mutation and merge rules outside React components.
- Run GitNexus impact analysis before editing existing functions, classes, or methods.
- Warn the user and pause if GitNexus reports HIGH or CRITICAL risk for an edited symbol.
- Run `mcp__gitnexus.detect_changes({ repo: "onetab", scope: "staged" })` before each commit.
- Preserve user work already present in the working tree; only stage files touched by this plan.
- Batch notes merge removes source groups directly after appending their tabs to `笔记`.
- The active `笔记` group is disabled in Manager selection mode and cannot be included in active batch actions.

---

## File Structure

- Create `src/features/sessions/batch-session-groups.ts`
  - Owns batch move-to-trash, batch restore, batch permanent delete, and merge-into-notes storage mutations.

- Modify `tests/integration/features/session-management.test.ts`
  - Adds integration coverage for the four batch feature functions.

- Create `src/ui/manager/ManagerBulkActionToolbar.tsx`
  - Renders bucket-specific batch action controls with selected-count copy.

- Create `tests/unit/ui/manager-bulk-action-toolbar.test.ts`
  - Static-render tests for active and trash toolbar controls.

- Modify `src/ui/manager/App.tsx`
  - Adds bucket-aware selection state, batch handlers, selection-mode sidebar rows, and imports for new feature functions and toolbar.

- Modify `src/ui/shared/app-shell.css`
  - Adds compact sidebar toolbar, checkbox, and disabled-row styles.

---

### Task 1: Add Batch Session Group Feature Functions

**Files:**
- Create: `src/features/sessions/batch-session-groups.ts`
- Modify: `tests/integration/features/session-management.test.ts`

**Interfaces:**
- Consumes:
  - `ExtensionStorageArea`, `readRootState`, `writeRootState` from `src/storage/local/repository.ts`
  - `createSessionGroup(tabs, options)` from `src/domain/sessions/create-session-group.ts`
  - `DEFAULT_NOTES_GROUP_TITLE`, `selectDefaultNotesGroup` from `src/domain/sessions/default-notes-group.ts`
  - `isSessionGroupTrashed` from `src/domain/sessions/session-groups.ts`
- Produces:
  - `batchMoveSessionGroupsToTrash(sessionIds: string[], dependencies?: BatchSessionGroupDependencies): Promise<number>`
  - `mergeSessionGroupsIntoDefaultNotesGroup(sessionIds: string[], dependencies?: BatchSessionGroupDependencies): Promise<MergeSessionGroupsIntoDefaultNotesGroupResult>`
  - `batchRestoreSessionGroupsFromTrash(sessionIds: string[], dependencies?: BatchSessionGroupDependencies): Promise<number>`
  - `batchDeleteSessionGroupsPermanently(sessionIds: string[], dependencies?: BatchDeleteSessionGroupsPermanentlyDependencies): Promise<number>`

- [ ] **Step 1: Run GitNexus impact analysis for nearby session mutation symbols**

Run:

```bash
# Use MCP tools, not shell, for these calls:
mcp__gitnexus.impact({ repo: "onetab", target: "deleteSessionGroup", direction: "upstream" })
mcp__gitnexus.impact({ repo: "onetab", target: "deleteSessionGroupPermanently", direction: "upstream" })
mcp__gitnexus.impact({ repo: "onetab", target: "restoreSessionGroupFromTrash", direction: "upstream" })
```

Expected: LOW or MEDIUM risk. If any result is HIGH or CRITICAL, report the risk summary to the user before continuing.

- [ ] **Step 2: Write failing integration tests**

Add these imports to `tests/integration/features/session-management.test.ts`:

```ts
import {
  batchDeleteSessionGroupsPermanently,
  batchMoveSessionGroupsToTrash,
  batchRestoreSessionGroupsFromTrash,
  mergeSessionGroupsIntoDefaultNotesGroup
} from "../../../src/features/sessions/batch-session-groups";
import { DEFAULT_NOTES_GROUP_TITLE } from "../../../src/domain/sessions/default-notes-group";
```

Replace the local `createSessionGroup` helper with this version so tests can create distinct groups:

```ts
function createSessionGroup(overrides: Partial<SessionGroup> = {}): SessionGroup {
  const id = overrides.id ?? "session-1";

  return {
    id,
    title: "Initial Title",
    createdAt: "2026-04-19T10:00:00.000Z",
    updatedAt: "2026-04-19T10:00:00.000Z",
    trashedAt: null,
    tabCount: 2,
    pinned: false,
    sourceWindowId: 1,
    tabs: [
      {
        id: `tab-${id}-1`,
        title: "A",
        url: `https://example.com/${id}/a`,
        favIconUrl: null,
        createdAt: "2026-04-19T10:00:00.000Z",
        lastOpenedAt: null,
        originalIndex: 0
      },
      {
        id: `tab-${id}-2`,
        title: "B",
        url: `https://example.com/${id}/b`,
        favIconUrl: null,
        createdAt: "2026-04-19T10:00:00.000Z",
        lastOpenedAt: null,
        originalIndex: 1
      }
    ],
    ...overrides
  };
}
```

Add these tests inside `describe("session management features", () => { ... })`:

```ts
  it("should batch move active session groups into the trash", async () => {
    const storage = createMemoryStorage();
    const rootState = createDefaultRootState();
    rootState.sessions = [
      createSessionGroup({ id: "session-1", title: "One" }),
      createSessionGroup({ id: "session-2", title: "Two" }),
      createSessionGroup({ id: "session-3", title: "Three" })
    ];

    await writeRootState(storage, rootState);

    const movedCount = await batchMoveSessionGroupsToTrash(["session-1", "session-2"], {
      storage,
      now: () => new Date("2026-04-19T11:20:00.000Z")
    });
    const state = await readRootState(storage);

    expect(movedCount).toBe(2);
    expect(state.sessions.find((session) => session.id === "session-1")?.trashedAt).toBe(
      "2026-04-19T11:20:00.000Z"
    );
    expect(state.sessions.find((session) => session.id === "session-2")?.trashedAt).toBe(
      "2026-04-19T11:20:00.000Z"
    );
    expect(state.sessions.find((session) => session.id === "session-3")?.trashedAt).toBeNull();
  });

  it("should reject trash ids when batch moving active groups to trash", async () => {
    const storage = createMemoryStorage();
    const rootState = createDefaultRootState();
    rootState.sessions = [
      createSessionGroup({ id: "session-1", trashedAt: "2026-04-19T10:30:00.000Z" })
    ];

    await writeRootState(storage, rootState);

    await expect(
      batchMoveSessionGroupsToTrash(["session-1"], {
        storage,
        now: () => new Date("2026-04-19T11:20:00.000Z")
      })
    ).rejects.toThrow("Only active session groups can be moved to trash.");
  });

  it("should merge active session groups into an existing notes group and remove sources", async () => {
    const storage = createMemoryStorage();
    const rootState = createDefaultRootState();
    rootState.sessions = [
      createSessionGroup({
        id: "notes",
        title: DEFAULT_NOTES_GROUP_TITLE,
        tabCount: 1,
        tabs: [
          {
            id: "tab-notes-1",
            title: "Existing",
            url: "https://example.com/existing",
            favIconUrl: null,
            createdAt: "2026-04-19T09:00:00.000Z",
            lastOpenedAt: null,
            originalIndex: 4
          }
        ]
      }),
      createSessionGroup({ id: "session-1", title: "One" }),
      createSessionGroup({ id: "session-2", title: "Two" })
    ];

    await writeRootState(storage, rootState);

    const result = await mergeSessionGroupsIntoDefaultNotesGroup(["notes", "session-1", "session-2"], {
      storage,
      now: () => new Date("2026-04-19T12:00:00.000Z")
    });
    const state = await readRootState(storage);
    const notes = state.sessions.find((session) => session.id === "notes");

    expect(result.mergedGroupCount).toBe(2);
    expect(result.mergedTabCount).toBe(4);
    expect(notes?.tabCount).toBe(5);
    expect(notes?.updatedAt).toBe("2026-04-19T12:00:00.000Z");
    expect(notes?.tabs.map((tab) => tab.originalIndex)).toEqual([4, 5, 6, 7, 8]);
    expect(state.sessions.some((session) => session.id === "session-1")).toBe(false);
    expect(state.sessions.some((session) => session.id === "session-2")).toBe(false);
    expect(state.sessions.some((session) => session.id === "notes")).toBe(true);
  });

  it("should create notes group when merging active groups and no notes group exists", async () => {
    const storage = createMemoryStorage();
    const rootState = createDefaultRootState();
    rootState.sessions = [
      createSessionGroup({ id: "session-1", title: "One" }),
      createSessionGroup({ id: "session-2", title: "Two" })
    ];

    await writeRootState(storage, rootState);

    const result = await mergeSessionGroupsIntoDefaultNotesGroup(["session-1", "session-2"], {
      storage,
      now: () => new Date("2026-04-19T12:00:00.000Z")
    });
    const state = await readRootState(storage);
    const notes = state.sessions.find((session) => session.title === DEFAULT_NOTES_GROUP_TITLE);

    expect(result.targetSession.title).toBe(DEFAULT_NOTES_GROUP_TITLE);
    expect(result.mergedGroupCount).toBe(2);
    expect(result.mergedTabCount).toBe(4);
    expect(notes?.tabCount).toBe(4);
    expect(notes?.tabs.map((tab) => tab.originalIndex)).toEqual([0, 1, 2, 3]);
    expect(state.sessions).toHaveLength(1);
  });

  it("should reject trash groups when merging into notes", async () => {
    const storage = createMemoryStorage();
    const rootState = createDefaultRootState();
    rootState.sessions = [
      createSessionGroup({
        id: "session-1",
        title: "One",
        trashedAt: "2026-04-19T10:30:00.000Z"
      })
    ];

    await writeRootState(storage, rootState);

    await expect(
      mergeSessionGroupsIntoDefaultNotesGroup(["session-1"], {
        storage,
        now: () => new Date("2026-04-19T12:00:00.000Z")
      })
    ).rejects.toThrow("Only active session groups can be merged into notes.");
  });

  it("should batch restore trash session groups", async () => {
    const storage = createMemoryStorage();
    const rootState = createDefaultRootState();
    rootState.sessions = [
      createSessionGroup({ id: "session-1", trashedAt: "2026-04-19T10:30:00.000Z" }),
      createSessionGroup({ id: "session-2", trashedAt: "2026-04-19T10:35:00.000Z" })
    ];

    await writeRootState(storage, rootState);

    const restoredCount = await batchRestoreSessionGroupsFromTrash(["session-1", "session-2"], {
      storage,
      now: () => new Date("2026-04-19T12:30:00.000Z")
    });
    const state = await readRootState(storage);

    expect(restoredCount).toBe(2);
    expect(state.sessions.every((session) => session.trashedAt === null)).toBe(true);
    expect(state.sessions.every((session) => session.updatedAt === "2026-04-19T12:30:00.000Z")).toBe(
      true
    );
  });

  it("should batch permanently delete trash session groups and reject active ids", async () => {
    const storage = createMemoryStorage();
    const rootState = createDefaultRootState();
    rootState.sessions = [
      createSessionGroup({ id: "session-1", trashedAt: "2026-04-19T10:30:00.000Z" }),
      createSessionGroup({ id: "session-2", trashedAt: "2026-04-19T10:35:00.000Z" }),
      createSessionGroup({ id: "session-3", trashedAt: null })
    ];

    await writeRootState(storage, rootState);

    await expect(batchDeleteSessionGroupsPermanently(["session-3"], { storage })).rejects.toThrow(
      "Only trash session groups can be permanently deleted."
    );

    const deletedCount = await batchDeleteSessionGroupsPermanently(["session-1", "session-2"], {
      storage
    });
    const state = await readRootState(storage);

    expect(deletedCount).toBe(2);
    expect(state.sessions.map((session) => session.id)).toEqual(["session-3"]);
  });
```

- [ ] **Step 3: Run the tests to verify they fail**

Run:

```bash
npm run test -- tests/integration/features/session-management.test.ts
```

Expected: FAIL because `src/features/sessions/batch-session-groups.ts` does not exist.

- [ ] **Step 4: Implement the feature functions**

Create `src/features/sessions/batch-session-groups.ts`:

```ts
import { chromeLocalStorage } from "../../adapters/chrome/storage";
import { createSessionGroup } from "../../domain/sessions/create-session-group";
import {
  DEFAULT_NOTES_GROUP_TITLE,
  selectDefaultNotesGroup
} from "../../domain/sessions/default-notes-group";
import { isSessionGroupTrashed } from "../../domain/sessions/session-groups";
import {
  readRootState,
  writeRootState,
  type ExtensionStorageArea
} from "../../storage/local/repository";
import type { SessionGroup } from "../../types/session";

interface BatchSessionGroupDependencies {
  storage: ExtensionStorageArea;
  now?: () => Date;
}

interface BatchDeleteSessionGroupsPermanentlyDependencies {
  storage: ExtensionStorageArea;
}

export interface MergeSessionGroupsIntoDefaultNotesGroupResult {
  targetSession: SessionGroup;
  mergedGroupCount: number;
  mergedTabCount: number;
}

function uniqueSessionIds(sessionIds: string[]): string[] {
  return Array.from(new Set(sessionIds.map((sessionId) => sessionId.trim()).filter(Boolean)));
}

function requireSelection(sessionIds: string[]): string[] {
  const selectedSessionIds = uniqueSessionIds(sessionIds);

  if (selectedSessionIds.length === 0) {
    throw new Error("Select at least one session group.");
  }

  return selectedSessionIds;
}

function selectSessionsById(sessionGroups: SessionGroup[], sessionIds: string[]): SessionGroup[] {
  const selectedIds = new Set(sessionIds);
  const selectedSessions = sessionGroups.filter((session) => selectedIds.has(session.id));

  if (selectedSessions.length !== selectedIds.size) {
    throw new Error("Session group not found.");
  }

  return selectedSessions;
}

function getNextTopActiveSortOrder(sessionGroups: SessionGroup[]): number {
  const activeSortOrders = sessionGroups
    .filter((session) => !isSessionGroupTrashed(session))
    .map((session) => session.sortOrder)
    .filter((sortOrder): sortOrder is number => typeof sortOrder === "number");

  return activeSortOrders.length > 0 ? Math.min(...activeSortOrders) - 1 : 0;
}

export async function batchMoveSessionGroupsToTrash(
  sessionIds: string[],
  dependencies: BatchSessionGroupDependencies = {
    storage: chromeLocalStorage,
    now: () => new Date()
  }
): Promise<number> {
  const selectedSessionIds = requireSelection(sessionIds);
  const state = await readRootState(dependencies.storage);
  const selectedSessions = selectSessionsById(state.sessions, selectedSessionIds);

  if (selectedSessions.some(isSessionGroupTrashed)) {
    throw new Error("Only active session groups can be moved to trash.");
  }

  const trashedAt = (dependencies.now?.() ?? new Date()).toISOString();
  const selectedIds = new Set(selectedSessionIds);
  const nextSessions = state.sessions.map((session) =>
    selectedIds.has(session.id)
      ? {
          ...session,
          trashedAt,
          updatedAt: trashedAt
        }
      : session
  );

  await writeRootState(dependencies.storage, {
    ...state,
    sessions: nextSessions
  });

  return selectedSessions.length;
}

export async function mergeSessionGroupsIntoDefaultNotesGroup(
  sessionIds: string[],
  dependencies: BatchSessionGroupDependencies = {
    storage: chromeLocalStorage,
    now: () => new Date()
  }
): Promise<MergeSessionGroupsIntoDefaultNotesGroupResult> {
  const selectedSessionIds = requireSelection(sessionIds);
  const state = await readRootState(dependencies.storage);
  const now = dependencies.now?.() ?? new Date();
  const mergedAt = now.toISOString();
  const existingTarget = selectDefaultNotesGroup(state.sessions);
  const sourceIds = new Set(
    selectedSessionIds.filter((sessionId) => sessionId !== existingTarget?.id)
  );

  if (sourceIds.size === 0) {
    throw new Error("Select at least one non-notes session group.");
  }

  const sourceSessions = selectSessionsById(state.sessions, Array.from(sourceIds));

  if (sourceSessions.some(isSessionGroupTrashed)) {
    throw new Error("Only active session groups can be merged into notes.");
  }

  const targetSession =
    existingTarget ??
    {
      ...createSessionGroup([], {
        now,
        title: DEFAULT_NOTES_GROUP_TITLE,
        sourceWindowId: null
      }),
      sortOrder: getNextTopActiveSortOrder(state.sessions)
    };
  let nextOriginalIndex =
    targetSession.tabs.reduce(
      (maxValue, savedTab) => Math.max(maxValue, savedTab.originalIndex),
      -1
    ) + 1;
  const movedTabs = sourceSessions.flatMap((session) =>
    session.tabs.map((savedTab) => ({
      ...savedTab,
      originalIndex: nextOriginalIndex++
    }))
  );
  const nextTargetSession: SessionGroup = {
    ...targetSession,
    tabs: [...targetSession.tabs, ...movedTabs],
    tabCount: targetSession.tabs.length + movedTabs.length,
    updatedAt: mergedAt
  };
  let targetWasInserted = false;
  const nextSessions = state.sessions.flatMap((session) => {
    if (sourceIds.has(session.id)) {
      return [];
    }

    if (session.id === nextTargetSession.id) {
      targetWasInserted = true;
      return [nextTargetSession];
    }

    return [session];
  });

  if (!targetWasInserted) {
    nextSessions.unshift(nextTargetSession);
  }

  await writeRootState(dependencies.storage, {
    ...state,
    sessions: nextSessions
  });

  return {
    targetSession: nextTargetSession,
    mergedGroupCount: sourceSessions.length,
    mergedTabCount: movedTabs.length
  };
}

export async function batchRestoreSessionGroupsFromTrash(
  sessionIds: string[],
  dependencies: BatchSessionGroupDependencies = {
    storage: chromeLocalStorage,
    now: () => new Date()
  }
): Promise<number> {
  const selectedSessionIds = requireSelection(sessionIds);
  const state = await readRootState(dependencies.storage);
  const selectedSessions = selectSessionsById(state.sessions, selectedSessionIds);

  if (selectedSessions.some((session) => !isSessionGroupTrashed(session))) {
    throw new Error("Only trash session groups can be restored.");
  }

  const restoredAt = (dependencies.now?.() ?? new Date()).toISOString();
  const selectedIds = new Set(selectedSessionIds);
  const nextSessions = state.sessions.map((session) =>
    selectedIds.has(session.id)
      ? {
          ...session,
          trashedAt: null,
          updatedAt: restoredAt
        }
      : session
  );

  await writeRootState(dependencies.storage, {
    ...state,
    sessions: nextSessions
  });

  return selectedSessions.length;
}

export async function batchDeleteSessionGroupsPermanently(
  sessionIds: string[],
  dependencies: BatchDeleteSessionGroupsPermanentlyDependencies = {
    storage: chromeLocalStorage
  }
): Promise<number> {
  const selectedSessionIds = requireSelection(sessionIds);
  const state = await readRootState(dependencies.storage);
  const selectedSessions = selectSessionsById(state.sessions, selectedSessionIds);

  if (selectedSessions.some((session) => !isSessionGroupTrashed(session))) {
    throw new Error("Only trash session groups can be permanently deleted.");
  }

  const selectedIds = new Set(selectedSessionIds);

  await writeRootState(dependencies.storage, {
    ...state,
    sessions: state.sessions.filter((session) => !selectedIds.has(session.id))
  });

  return selectedSessions.length;
}
```

- [ ] **Step 5: Run the focused tests**

Run:

```bash
npm run test -- tests/integration/features/session-management.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run typecheck for new exports and strict types**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Stage, detect changes, and commit**

Run:

```bash
git add src/features/sessions/batch-session-groups.ts tests/integration/features/session-management.test.ts
```

Then run:

```bash
# Use MCP tool:
mcp__gitnexus.detect_changes({ repo: "onetab", scope: "staged" })
```

Expected: changed symbols include the new batch functions and no unexpected existing runtime flow changes.

Commit:

```bash
git commit -m "feat: add batch session group operations"
```

---

### Task 2: Add Manager Batch Toolbar Component

**Files:**
- Create: `src/ui/manager/ManagerBulkActionToolbar.tsx`
- Create: `tests/unit/ui/manager-bulk-action-toolbar.test.ts`

**Interfaces:**
- Consumes:
  - `SessionBucket = "active" | "trash"` shape from `ManagerApp`; the component defines its own local prop union to avoid exporting Manager internals.
- Produces:
  - `ManagerBulkActionToolbar(props: ManagerBulkActionToolbarProps): JSX.Element`

- [ ] **Step 1: Write the failing static render tests**

Create `tests/unit/ui/manager-bulk-action-toolbar.test.ts`:

```ts
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ManagerBulkActionToolbar } from "../../../src/ui/manager/ManagerBulkActionToolbar";

describe("ManagerBulkActionToolbar", () => {
  it("should render active group batch actions", () => {
    const markup = renderToStaticMarkup(
      createElement(ManagerBulkActionToolbar, {
        bucket: "active",
        disabled: false,
        selectedCount: 2,
        onCancel: () => {},
        onMoveToTrash: () => {},
        onMergeIntoNotes: () => {},
        onRestore: () => {},
        onPermanentDelete: () => {}
      })
    );

    expect(markup).toContain("已选 2 个");
    expect(markup).toContain("移到回收站");
    expect(markup).toContain("合并入笔记");
    expect(markup).not.toContain("恢复");
    expect(markup).not.toContain("永久删除");
  });

  it("should render trash group batch actions", () => {
    const markup = renderToStaticMarkup(
      createElement(ManagerBulkActionToolbar, {
        bucket: "trash",
        disabled: false,
        selectedCount: 3,
        onCancel: () => {},
        onMoveToTrash: () => {},
        onMergeIntoNotes: () => {},
        onRestore: () => {},
        onPermanentDelete: () => {}
      })
    );

    expect(markup).toContain("已选 3 个");
    expect(markup).toContain("恢复");
    expect(markup).toContain("永久删除");
    expect(markup).not.toContain("移到回收站");
    expect(markup).not.toContain("合并入笔记");
  });

  it("should disable mutation actions when no groups are selected", () => {
    const markup = renderToStaticMarkup(
      createElement(ManagerBulkActionToolbar, {
        bucket: "active",
        disabled: false,
        selectedCount: 0,
        onCancel: () => {},
        onMoveToTrash: () => {},
        onMergeIntoNotes: () => {},
        onRestore: () => {},
        onPermanentDelete: () => {}
      })
    );

    expect(markup).toContain("已选 0 个");
    expect(markup).toContain("disabled=\"\"");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm run test -- tests/unit/ui/manager-bulk-action-toolbar.test.ts
```

Expected: FAIL because `src/ui/manager/ManagerBulkActionToolbar.tsx` does not exist.

- [ ] **Step 3: Create the toolbar component**

Create `src/ui/manager/ManagerBulkActionToolbar.tsx`:

```tsx
type ManagerBulkActionBucket = "active" | "trash";

interface ManagerBulkActionToolbarProps {
  bucket: ManagerBulkActionBucket;
  disabled: boolean;
  selectedCount: number;
  onCancel: () => void;
  onMoveToTrash: () => void | Promise<void>;
  onMergeIntoNotes: () => void | Promise<void>;
  onRestore: () => void | Promise<void>;
  onPermanentDelete: () => void | Promise<void>;
}

export function ManagerBulkActionToolbar({
  bucket,
  disabled,
  selectedCount,
  onCancel,
  onMoveToTrash,
  onMergeIntoNotes,
  onRestore,
  onPermanentDelete
}: ManagerBulkActionToolbarProps) {
  const actionDisabled = disabled || selectedCount === 0;

  return (
    <div
      aria-label={bucket === "active" ? "全部分组批量操作" : "回收站分组批量操作"}
      className="manager-tree__batch-toolbar"
      role="group"
    >
      <span className="manager-tree__batch-count">已选 {selectedCount} 个</span>
      <div className="manager-tree__batch-actions">
        {bucket === "active" ? (
          <>
            <button
              className="button button--quiet button--small"
              disabled={actionDisabled}
              onClick={() => void onMoveToTrash()}
              type="button"
            >
              移到回收站
            </button>
            <button
              className="button button--secondary button--small"
              disabled={actionDisabled}
              onClick={() => void onMergeIntoNotes()}
              type="button"
            >
              合并入笔记
            </button>
          </>
        ) : (
          <>
            <button
              className="button button--quiet button--small"
              disabled={actionDisabled}
              onClick={() => void onRestore()}
              type="button"
            >
              恢复
            </button>
            <button
              className="button button--secondary button--small"
              disabled={actionDisabled}
              onClick={() => void onPermanentDelete()}
              type="button"
            >
              永久删除
            </button>
          </>
        )}
        <button
          className="button button--quiet button--small"
          disabled={disabled}
          onClick={onCancel}
          type="button"
        >
          取消
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the focused UI test**

Run:

```bash
npm run test -- tests/unit/ui/manager-bulk-action-toolbar.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Stage, detect changes, and commit**

Run:

```bash
git add src/ui/manager/ManagerBulkActionToolbar.tsx tests/unit/ui/manager-bulk-action-toolbar.test.ts
```

Then run:

```bash
# Use MCP tool:
mcp__gitnexus.detect_changes({ repo: "onetab", scope: "staged" })
```

Expected: changed symbols include `ManagerBulkActionToolbar`.

Commit:

```bash
git commit -m "feat: add manager batch action toolbar"
```

---

### Task 3: Wire Batch Selection Into ManagerApp

**Files:**
- Modify: `src/ui/manager/App.tsx`

**Interfaces:**
- Consumes:
  - Feature functions from `src/features/sessions/batch-session-groups.ts`
  - `DEFAULT_NOTES_GROUP_TITLE` from `src/domain/sessions/default-notes-group.ts`
  - `ManagerBulkActionToolbar` from `src/ui/manager/ManagerBulkActionToolbar.tsx`
- Produces:
  - Bucket-aware selection mode in `ManagerApp`
  - Batch action handlers for active and trash sections

- [ ] **Step 1: Run GitNexus impact analysis for ManagerApp**

Run:

```bash
# Use MCP tool:
mcp__gitnexus.impact({ repo: "onetab", target: "ManagerApp", direction: "upstream" })
```

Expected: LOW or MEDIUM risk. If the result is HIGH or CRITICAL, report the risk summary to the user before continuing.

- [ ] **Step 2: Add imports**

Modify the import block in `src/ui/manager/App.tsx`:

```tsx
import {
  batchDeleteSessionGroupsPermanently,
  batchMoveSessionGroupsToTrash,
  batchRestoreSessionGroupsFromTrash,
  mergeSessionGroupsIntoDefaultNotesGroup
} from "../../features/sessions/batch-session-groups";
import { DEFAULT_NOTES_GROUP_TITLE } from "../../domain/sessions/default-notes-group";
import { ManagerBulkActionToolbar } from "./ManagerBulkActionToolbar";
```

- [ ] **Step 3: Add selection state**

Add this state near the existing sidebar/menu state in `ManagerApp`:

```tsx
  const [bulkSelectionBucket, setBulkSelectionBucket] = useState<SessionBucket | null>(null);
  const [selectedActiveSessionIds, setSelectedActiveSessionIds] = useState<string[]>([]);
  const [selectedTrashSessionIds, setSelectedTrashSessionIds] = useState<string[]>([]);
```

Add these derived values after `liveStatusMessage`:

```tsx
  const isBulkSelectingActive = bulkSelectionBucket === "active";
  const isBulkSelectingTrash = bulkSelectionBucket === "trash";
  const selectedActiveSessionIdSet = useMemo(
    () => new Set(selectedActiveSessionIds),
    [selectedActiveSessionIds]
  );
  const selectedTrashSessionIdSet = useMemo(
    () => new Set(selectedTrashSessionIds),
    [selectedTrashSessionIds]
  );
  const selectableActiveSessionCount = sessionCollections.activeSessions.filter(
    (session) => session.title !== DEFAULT_NOTES_GROUP_TITLE
  ).length;
```

- [ ] **Step 4: Prune stale selections after collection changes**

Add this effect after the existing `ResizeObserver` effect:

```tsx
  useEffect(() => {
    const activeIds = new Set(sessionCollections.activeSessions.map((session) => session.id));
    const trashIds = new Set(sessionCollections.trashedSessions.map((session) => session.id));

    setSelectedActiveSessionIds((current) =>
      current.filter((sessionId) => activeIds.has(sessionId))
    );
    setSelectedTrashSessionIds((current) => current.filter((sessionId) => trashIds.has(sessionId)));
  }, [sessionCollections]);
```

- [ ] **Step 5: Add selection helpers**

Add these helper functions after `closeSessionMenus`:

```tsx
  function enterBulkSelection(bucket: SessionBucket) {
    setShowMoreActions(false);
    closeSessionMenus();
    clearDragState();
    setBulkSelectionBucket(bucket);
  }

  function cancelBulkSelection() {
    setBulkSelectionBucket(null);
    setSelectedActiveSessionIds([]);
    setSelectedTrashSessionIds([]);
  }

  function toggleBulkSessionSelection(bucket: SessionBucket, sessionId: string) {
    const updateSelection = (current: string[]) =>
      current.includes(sessionId)
        ? current.filter((selectedSessionId) => selectedSessionId !== sessionId)
        : [...current, sessionId];

    if (bucket === "active") {
      setSelectedActiveSessionIds(updateSelection);
      return;
    }

    setSelectedTrashSessionIds(updateSelection);
  }
```

Modify `selectBucket`, `selectSession`, and `focusSearchHit` to leave selection mode when the user navigates normally:

```tsx
  function selectBucket(bucket: SessionBucket) {
    const sessions =
      bucket === "trash" ? sessionCollections.trashedSessions : sessionCollections.activeSessions;
    cancelBulkSelection();
    setShowMoreActions(false);
    closeSessionMenus();
    setSelectedBucket(bucket);
    setSelectedSessionId(sessions[0]?.id ?? null);
  }

  function selectSession(bucket: SessionBucket, sessionId: string) {
    cancelBulkSelection();
    setShowMoreActions(false);
    closeSessionMenus();
    setSelectedBucket(bucket);
    setSelectedSessionId(sessionId);
  }
```

In `focusSearchHit`, add `cancelBulkSelection();` before `setShowMoreActions(false);`.

- [ ] **Step 6: Add batch action handlers**

Add these handlers near the existing single-group handlers:

```tsx
  async function handleBatchMoveGroupsToTrash() {
    const selectedCount = selectedActiveSessionIds.length;

    if (selectedCount === 0) {
      return;
    }

    const shouldMove = window.confirm(`将选中的 ${selectedCount} 个分组移动到回收站？`);

    if (!shouldMove) {
      return;
    }

    setBusyKey("batch-trash");
    closeSessionMenus();

    try {
      const movedCount = await batchMoveSessionGroupsToTrash(selectedActiveSessionIds);
      setStatus(`已将 ${movedCount} 个分组移动到回收站。`);
      cancelBulkSelection();
      await loadSessionCollections("active", null);
    } catch (nextError: unknown) {
      setStatus(nextError instanceof Error ? nextError.message : "批量移动到回收站失败。");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleBatchMergeGroupsIntoNotes() {
    const selectedCount = selectedActiveSessionIds.length;

    if (selectedCount === 0) {
      return;
    }

    const shouldMerge = window.confirm(
      `将选中的 ${selectedCount} 个分组合并入“笔记”？合并后原分组会直接删除。`
    );

    if (!shouldMerge) {
      return;
    }

    setBusyKey("batch-merge-notes");
    closeSessionMenus();

    try {
      const result = await mergeSessionGroupsIntoDefaultNotesGroup(selectedActiveSessionIds);
      setStatus(`已将 ${result.mergedGroupCount} 个分组合并入“笔记”。`);
      cancelBulkSelection();
      await loadSessionCollections("active", result.targetSession.id);
    } catch (nextError: unknown) {
      setStatus(nextError instanceof Error ? nextError.message : "批量合并入笔记失败。");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleBatchRestoreGroupsFromTrash() {
    const selectedCount = selectedTrashSessionIds.length;

    if (selectedCount === 0) {
      return;
    }

    setBusyKey("batch-restore-trash");
    closeSessionMenus();

    try {
      const restoredCount = await batchRestoreSessionGroupsFromTrash(selectedTrashSessionIds);
      setStatus(`已恢复 ${restoredCount} 个分组。`);
      cancelBulkSelection();
      await loadSessionCollections("active", null);
    } catch (nextError: unknown) {
      setStatus(nextError instanceof Error ? nextError.message : "批量恢复失败。");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleBatchDeleteGroupsPermanently() {
    const selectedCount = selectedTrashSessionIds.length;

    if (selectedCount === 0) {
      return;
    }

    const shouldDelete = window.confirm(`永久删除选中的 ${selectedCount} 个分组？此操作无法撤销。`);

    if (!shouldDelete) {
      return;
    }

    setBusyKey("batch-permanent-delete");
    closeSessionMenus();

    try {
      const deletedCount = await batchDeleteSessionGroupsPermanently(selectedTrashSessionIds);
      setStatus(`已永久删除 ${deletedCount} 个分组。`);
      cancelBulkSelection();
      await loadSessionCollections("trash", null);
    } catch (nextError: unknown) {
      setStatus(nextError instanceof Error ? nextError.message : "批量永久删除失败。");
    } finally {
      setBusyKey(null);
    }
  }
```

- [ ] **Step 7: Disable drag behavior while active selection mode is open**

At the top of `handleSessionDragStart`, add:

```tsx
    if (bulkSelectionBucket !== null) {
      event.preventDefault();
      return;
    }
```

At the top of `handleSessionDragOver`, add `bulkSelectionBucket !== null` to the guard:

```tsx
    if (selectedBucket !== "active" || bulkSelectionBucket !== null) {
      return;
    }
```

- [ ] **Step 8: Add active section selection controls**

In the active sidebar section, replace the standalone active toggle button with:

```tsx
                <div className="manager-tree__section-actions">
                  <button
                    className="manager-tree__toggle"
                    onClick={() => setIsActiveExpanded((current) => !current)}
                    type="button"
                  >
                    {isActiveExpanded ? "收起" : "展开"}
                  </button>
                  <button
                    className="manager-tree__toggle"
                    disabled={busyKey !== null || selectableActiveSessionCount === 0}
                    onClick={() =>
                      isBulkSelectingActive ? cancelBulkSelection() : enterBulkSelection("active")
                    }
                    type="button"
                  >
                    {isBulkSelectingActive ? "取消选择" : "选择"}
                  </button>
                </div>
```

Render the toolbar immediately after that block:

```tsx
                {isBulkSelectingActive ? (
                  <ManagerBulkActionToolbar
                    bucket="active"
                    disabled={busyKey !== null}
                    onCancel={cancelBulkSelection}
                    onMergeIntoNotes={handleBatchMergeGroupsIntoNotes}
                    onMoveToTrash={handleBatchMoveGroupsToTrash}
                    onPermanentDelete={handleBatchDeleteGroupsPermanently}
                    onRestore={handleBatchRestoreGroupsFromTrash}
                    selectedCount={selectedActiveSessionIds.length}
                  />
                ) : null}
```

Inside the active `map`, compute these constants before returning the `li`:

```tsx
                    {sessionCollections.activeSessions.map((session) => {
                      const isDefaultNotesGroup = session.title === DEFAULT_NOTES_GROUP_TITLE;
                      const isBulkSelected = selectedActiveSessionIdSet.has(session.id);
                      const isBulkDisabled = isBulkSelectingActive && isDefaultNotesGroup;
                    })}
```

Change the active `map` callback from an implicit JSX return to a block body, then return the existing `li` JSX after those constants.

Use this row class:

```tsx
                        className={`manager-tree__item ${hoveredActiveSessionMenuId === session.id ? "manager-tree__item--menu-open" : ""} ${isBulkDisabled ? "manager-tree__item--disabled" : ""}`}
```

Use this row wrapper class:

```tsx
                        <div
                          className={`manager-tree__node-row ${isBulkSelectingActive ? "manager-tree__node-row--selecting" : ""}`}
                        >
```

At the start of the active `.manager-tree__node-row`, render:

```tsx
                          {isBulkSelectingActive ? (
                            <input
                              aria-label={`选择分组：${session.title}`}
                              checked={isBulkSelected}
                              className="manager-tree__checkbox"
                              disabled={isBulkDisabled || busyKey !== null}
                              onChange={() => toggleBulkSessionSelection("active", session.id)}
                              title={isDefaultNotesGroup ? "笔记分组不能加入批量操作" : undefined}
                              type="checkbox"
                            />
                          ) : null}
```

Modify the active group button:

```tsx
                            aria-disabled={isBulkDisabled ? "true" : undefined}
                            draggable={!isBulkSelectingActive}
                            onClick={() => {
                              if (isBulkSelectingActive) {
                                if (!isBulkDisabled && busyKey === null) {
                                  toggleBulkSessionSelection("active", session.id);
                                }
                                return;
                              }

                              selectSession("active", session.id);
                            }}
```

Only render the active `...` menu trigger and popover when `!isBulkSelectingActive`.

- [ ] **Step 9: Add trash section selection controls**

In the trash sidebar section, replace the standalone trash toggle button with:

```tsx
                <div className="manager-tree__section-actions">
                  <button
                    className="manager-tree__toggle"
                    onClick={() => setIsTrashExpanded((current) => !current)}
                    type="button"
                  >
                    {isTrashExpanded ? "收起" : "展开"}
                  </button>
                  <button
                    className="manager-tree__toggle"
                    disabled={busyKey !== null || sessionCollections.trashedSessions.length === 0}
                    onClick={() =>
                      isBulkSelectingTrash ? cancelBulkSelection() : enterBulkSelection("trash")
                    }
                    type="button"
                  >
                    {isBulkSelectingTrash ? "取消选择" : "选择"}
                  </button>
                </div>
```

Render the toolbar immediately after that block:

```tsx
                {isBulkSelectingTrash ? (
                  <ManagerBulkActionToolbar
                    bucket="trash"
                    disabled={busyKey !== null}
                    onCancel={cancelBulkSelection}
                    onMergeIntoNotes={handleBatchMergeGroupsIntoNotes}
                    onMoveToTrash={handleBatchMoveGroupsToTrash}
                    onPermanentDelete={handleBatchDeleteGroupsPermanently}
                    onRestore={handleBatchRestoreGroupsFromTrash}
                    selectedCount={selectedTrashSessionIds.length}
                  />
                ) : null}
```

Inside the trash `map`, compute:

```tsx
                    {sessionCollections.trashedSessions.map((session) => {
                      const isBulkSelected = selectedTrashSessionIdSet.has(session.id);
                    })}
```

Change the trash `map` callback from an implicit JSX return to a block body, then return the existing `li` JSX after that constant.

Use this row wrapper class:

```tsx
                        <div
                          className={`manager-tree__node-row ${isBulkSelectingTrash ? "manager-tree__node-row--selecting" : ""}`}
                        >
```

At the start of the trash `.manager-tree__node-row`, render:

```tsx
                          {isBulkSelectingTrash ? (
                            <input
                              aria-label={`选择回收站分组：${session.title}`}
                              checked={isBulkSelected}
                              className="manager-tree__checkbox"
                              disabled={busyKey !== null}
                              onChange={() => toggleBulkSessionSelection("trash", session.id)}
                              type="checkbox"
                            />
                          ) : null}
```

Modify the trash group button:

```tsx
                            onClick={() => {
                              if (isBulkSelectingTrash) {
                                if (busyKey === null) {
                                  toggleBulkSessionSelection("trash", session.id);
                                }
                                return;
                              }

                              selectSession("trash", session.id);
                            }}
```

Only render the trash `...` menu trigger and popover when `!isBulkSelectingTrash`.

- [ ] **Step 10: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 11: Run focused tests**

Run:

```bash
npm run test -- tests/integration/features/session-management.test.ts tests/unit/ui/manager-bulk-action-toolbar.test.ts
```

Expected: PASS.

- [ ] **Step 12: Stage, detect changes, and commit**

Run:

```bash
git add src/ui/manager/App.tsx
```

Then run:

```bash
# Use MCP tool:
mcp__gitnexus.detect_changes({ repo: "onetab", scope: "staged" })
```

Expected: affected scope is Manager UI plus calls to the new batch feature functions.

Commit:

```bash
git commit -m "feat: wire manager group batch selection"
```

---

### Task 4: Add Sidebar Batch Styles

**Files:**
- Modify: `src/ui/shared/app-shell.css`

**Interfaces:**
- Consumes:
  - Classes emitted by `ManagerApp` and `ManagerBulkActionToolbar`
- Produces:
  - Stable compact layout for section actions, batch toolbar, and row checkboxes

- [ ] **Step 1: Run GitNexus impact analysis for the Manager shell that consumes these styles**

Run:

```bash
# Use MCP tool:
mcp__gitnexus.impact({ repo: "onetab", target: "ManagerApp", direction: "upstream" })
```

Expected: LOW or MEDIUM risk. If the result is HIGH or CRITICAL, report the risk summary to the user before continuing. This task only edits shared CSS, but the impact check is anchored to the Manager shell that will emit the new classes.

- [ ] **Step 2: Add sidebar batch styles**

Add this CSS after `.manager-tree__toggle`:

```css
.manager-tree__section-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 4px;
}

.manager-tree__section-actions .manager-tree__toggle {
  width: auto;
}
```

Add this CSS after `.manager-tree__children`:

```css
.manager-tree__batch-toolbar {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
  border: 1px solid rgba(24, 33, 38, 0.08);
  border-radius: 10px;
  background: rgba(250, 247, 241, 0.78);
}

.manager-tree__batch-count {
  color: #5f6a72;
  font-size: 12px;
  font-weight: 700;
}

.manager-tree__batch-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.manager-tree__checkbox {
  width: 16px;
  height: 16px;
  margin: 0 2px 0 0;
}
```

Add this CSS after `.manager-tree__node-row`:

```css
.manager-tree__node-row--selecting {
  grid-template-columns: auto minmax(0, 1fr) auto;
}
```

Add this CSS after `.manager-tree__item--menu-open`:

```css
.manager-tree__item--disabled {
  opacity: 0.58;
}

.manager-tree__item--disabled .manager-tree__node {
  cursor: not-allowed;
}
```

- [ ] **Step 3: Run lint and typecheck**

Run:

```bash
npm run lint
npm run typecheck
```

Expected: both PASS.

- [ ] **Step 4: Run focused tests**

Run:

```bash
npm run test -- tests/unit/ui/manager-bulk-action-toolbar.test.ts
```

Expected: PASS.

- [ ] **Step 5: Stage, detect changes, and commit**

Run:

```bash
git add src/ui/shared/app-shell.css
```

Then run:

```bash
# Use MCP tool:
mcp__gitnexus.detect_changes({ repo: "onetab", scope: "staged" })
```

Expected: no code execution flow changes, only style file changes.

Commit:

```bash
git commit -m "style: add manager batch selection controls"
```

---

### Task 5: Final Verification

**Files:**
- Verify: full working tree

**Interfaces:**
- Consumes all previous tasks.
- Produces a verified implementation ready for user review.

- [ ] **Step 1: Run the full required quality gates**

Run:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Expected: all PASS.

- [ ] **Step 2: Run end-to-end tests if Manager core paths changed beyond sidebar rendering**

Run:

```bash
npm run test:e2e
```

Expected: PASS. If the local environment cannot run browser tests, record the exact failure and continue only after explaining the verification gap to the user.

- [ ] **Step 3: Inspect final diff**

Run:

```bash
git status --short
git diff --stat
git diff -- src/features/sessions/batch-session-groups.ts src/ui/manager/App.tsx src/ui/manager/ManagerBulkActionToolbar.tsx src/ui/shared/app-shell.css tests/integration/features/session-management.test.ts tests/unit/ui/manager-bulk-action-toolbar.test.ts
```

Expected: only files from this plan are changed.

- [ ] **Step 4: Run GitNexus final change detection**

Run:

```bash
# Use MCP tool:
mcp__gitnexus.detect_changes({ repo: "onetab", scope: "all" })
```

Expected: changed symbols and affected flows match batch session group operations and Manager UI wiring.

- [ ] **Step 5: Commit any remaining verification-only adjustments**

If Task 5 required code or test adjustments, stage only those files:

```bash
git add src/features/sessions/batch-session-groups.ts src/ui/manager/App.tsx src/ui/manager/ManagerBulkActionToolbar.tsx src/ui/shared/app-shell.css tests/integration/features/session-management.test.ts tests/unit/ui/manager-bulk-action-toolbar.test.ts
```

Then run:

```bash
# Use MCP tool:
mcp__gitnexus.detect_changes({ repo: "onetab", scope: "staged" })
```

Commit:

```bash
git commit -m "test: verify manager batch group actions"
```

Skip this commit if Task 5 produced no file changes.

---

## Spec Coverage Self-Review

- Active batch move to trash: Task 1 feature function, Task 3 UI handler.
- Active batch merge into `笔记`: Task 1 feature function, Task 3 UI handler.
- Auto-create missing `笔记`: Task 1 merge implementation and test.
- Directly remove merge source groups: Task 1 merge implementation and test.
- Prevent target `笔记` from batch action selection: Task 3 disables active notes row in selection mode.
- Trash batch restore: Task 1 feature function, Task 3 UI handler.
- Trash batch permanent delete: Task 1 feature function, Task 3 UI handler.
- Existing single-group actions remain: Task 3 hides menus only in selection mode and keeps default mode unchanged.
- Drag behavior outside selection mode remains: Task 3 disables drag only while selection mode is active.
- Tests cover batch feature-layer behavior: Task 1.
- UI batch controls are test-covered: Task 2.
- Styling is scoped to Manager sidebar classes: Task 4.
