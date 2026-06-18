# Default Notes Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Default single-page capture actions save into a long-lived `笔记` session group, while bulk capture actions keep date-based groups.

**Architecture:** Add a small domain helper for selecting and appending to the default notes group, then route only single-tab capture through a new feature use case. Leave `captureBrowserTabs` unchanged so current-window, selected-tabs, and other bulk flows continue creating date groups.

**Tech Stack:** TypeScript strict mode, Chrome Extension MV3, React, Vite, Vitest, ESLint, GitNexus.

## Global Constraints

- Follow `/Users/zhangqijin/WebstormProjects/onetab/AGENTS.md`.
- Do not modify storage schema, migration logic, manifest permissions, or import/export formats.
- Do not add new dependencies.
- Do not introduce bare `any`.
- Keep business logic outside React components and Chrome callbacks.
- Run GitNexus impact analysis before editing existing functions or symbols.
- Run `mcp__gitnexus.detect_changes({ repo: "onetab", scope: "staged" })` before each commit.
- Preserve user work already present in the working tree; only stage files touched by this plan.
- Use `npm` scripts from `package.json`; this task does not use Python.

---

## File Structure

- Create `src/domain/sessions/default-notes-group.ts`
  - Owns `DEFAULT_NOTES_GROUP_TITLE`, selecting the writable notes group, and appending one capturable tab to a session group.

- Create `tests/unit/domain/default-notes-group.test.ts`
  - Unit coverage for notes group selection and pure append behavior.

- Create `src/features/sessions/capture/capture-browser-tab-to-default-notes-group.ts`
  - Feature use case for single-page default capture: validate tab, find/create `笔记`, write storage, then close the original tab.

- Modify `src/features/sessions/capture/capture-current-tab.ts`
  - Route Popup `Capture Current Tab` through the new default notes use case.

- Modify `src/features/sessions/capture/capture-browser-tab.ts`
  - Route page context-menu `Only Send This Tab To TabVault` through the new default notes use case.

- Modify `tests/integration/features/capture.test.ts`
  - Integration coverage for default notes capture, notes group reuse, trashed notes handling, write-failure safety, and bulk date capture preservation.

- Modify `docs/architecture/runtime-flows.md`
  - Document that current-tab capture writes to or creates `笔记`, while explicit Fixed Groups / Recent Groups and bulk capture keep existing behavior.

---

### Task 1: Add Default Notes Domain Helper

**Files:**
- Create: `src/domain/sessions/default-notes-group.ts`
- Create: `tests/unit/domain/default-notes-group.test.ts`

**Interfaces:**
- Consumes:
  - `SessionGroup` and `CapturableTab` from `src/types/session.ts`
  - `sortSessionGroups(sessionGroups: SessionGroup[]): SessionGroup[]`
  - `isSessionGroupTrashed(sessionGroup: SessionGroup): boolean`
- Produces:
  - `DEFAULT_NOTES_GROUP_TITLE: "笔记"`
  - `selectDefaultNotesGroup(sessionGroups: SessionGroup[]): SessionGroup | null`
  - `appendCapturableTabToSessionGroup(sessionGroup: SessionGroup, tab: CapturableTab, now: Date): SessionGroup`

- [ ] **Step 1: Write the failing unit test**

Create `tests/unit/domain/default-notes-group.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  appendCapturableTabToSessionGroup,
  DEFAULT_NOTES_GROUP_TITLE,
  selectDefaultNotesGroup
} from "../../../src/domain/sessions/default-notes-group";
import type { CapturableTab, SessionGroup } from "../../../src/types/session";

function createSessionGroup(overrides: Partial<SessionGroup>): SessionGroup {
  return {
    id: "session-default",
    title: "Default",
    createdAt: "2026-04-19T10:00:00.000Z",
    updatedAt: "2026-04-19T10:00:00.000Z",
    trashedAt: null,
    sortOrder: 10,
    tabCount: 0,
    pinned: false,
    sourceWindowId: null,
    tabs: [],
    ...overrides
  };
}

describe("default notes group", () => {
  it("should select the first active notes group using session group sort order", () => {
    const result = selectDefaultNotesGroup([
      createSessionGroup({
        id: "regular",
        title: DEFAULT_NOTES_GROUP_TITLE,
        sortOrder: 20,
        updatedAt: "2026-04-19T12:00:00.000Z"
      }),
      createSessionGroup({
        id: "trashed",
        title: DEFAULT_NOTES_GROUP_TITLE,
        trashedAt: "2026-04-19T12:30:00.000Z",
        sortOrder: 1
      }),
      createSessionGroup({
        id: "pinned",
        title: DEFAULT_NOTES_GROUP_TITLE,
        pinned: true,
        sortOrder: 99,
        updatedAt: "2026-04-19T08:00:00.000Z"
      }),
      createSessionGroup({
        id: "other",
        title: "保存于 2026-04-19",
        sortOrder: 0
      })
    ]);

    expect(result?.id).toBe("pinned");
  });

  it("should return null when no active notes group exists", () => {
    const result = selectDefaultNotesGroup([
      createSessionGroup({
        id: "trashed",
        title: DEFAULT_NOTES_GROUP_TITLE,
        trashedAt: "2026-04-19T12:30:00.000Z"
      }),
      createSessionGroup({
        id: "other",
        title: "保存于 2026-04-19"
      })
    ]);

    expect(result).toBeNull();
  });

  it("should append one capturable tab while preserving existing tabs", () => {
    const sessionGroup = createSessionGroup({
      id: "session-notes",
      title: DEFAULT_NOTES_GROUP_TITLE,
      tabCount: 1,
      updatedAt: "2026-04-19T10:00:00.000Z",
      tabs: [
        {
          id: "tab-existing",
          title: "Existing",
          url: "https://example.com/existing",
          favIconUrl: null,
          createdAt: "2026-04-19T10:00:00.000Z",
          lastOpenedAt: null,
          originalIndex: 3
        }
      ]
    });
    const tab: CapturableTab = {
      title: "  Added  ",
      url: "https://example.com/added",
      favIconUrl: "https://example.com/favicon.ico",
      index: 8
    };

    const result = appendCapturableTabToSessionGroup(
      sessionGroup,
      tab,
      new Date("2026-04-20T09:15:00.000Z")
    );

    expect(result.id).toBe("session-notes");
    expect(result.tabCount).toBe(2);
    expect(result.updatedAt).toBe("2026-04-20T09:15:00.000Z");
    expect(result.tabs.map((savedTab) => savedTab.url)).toEqual([
      "https://example.com/existing",
      "https://example.com/added"
    ]);
    expect(result.tabs[1]).toEqual({
      id: "tab_session-notes_1776676500000",
      title: "Added",
      url: "https://example.com/added",
      favIconUrl: "https://example.com/favicon.ico",
      createdAt: "2026-04-20T09:15:00.000Z",
      lastOpenedAt: null,
      originalIndex: 4
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm run test -- tests/unit/domain/default-notes-group.test.ts
```

Expected: FAIL because `src/domain/sessions/default-notes-group.ts` does not exist.

- [ ] **Step 3: Implement the domain helper**

Create `src/domain/sessions/default-notes-group.ts`:

```ts
import type { CapturableTab, SessionGroup } from "../../types/session";
import { isSessionGroupTrashed } from "./session-groups";
import { sortSessionGroups } from "./sort-session-groups";

export const DEFAULT_NOTES_GROUP_TITLE = "笔记";

export function selectDefaultNotesGroup(sessionGroups: SessionGroup[]): SessionGroup | null {
  const notesGroups = sessionGroups.filter(
    (sessionGroup) =>
      sessionGroup.title === DEFAULT_NOTES_GROUP_TITLE && !isSessionGroupTrashed(sessionGroup)
  );

  return sortSessionGroups(notesGroups)[0] ?? null;
}

export function appendCapturableTabToSessionGroup(
  sessionGroup: SessionGroup,
  tab: CapturableTab,
  now: Date
): SessionGroup {
  const nextOriginalIndex =
    sessionGroup.tabs.reduce(
      (maxValue, savedTab) => Math.max(maxValue, savedTab.originalIndex),
      -1
    ) + 1;
  const createdAt = now.toISOString();

  return {
    ...sessionGroup,
    tabs: [
      ...sessionGroup.tabs,
      {
        id: `tab_${sessionGroup.id}_${now.getTime()}`,
        title: tab.title?.trim() || tab.url,
        url: tab.url,
        favIconUrl: tab.favIconUrl ?? null,
        createdAt,
        lastOpenedAt: null,
        originalIndex: nextOriginalIndex
      }
    ],
    tabCount: sessionGroup.tabCount + 1,
    updatedAt: createdAt
  };
}
```

- [ ] **Step 4: Run the unit test to verify it passes**

Run:

```bash
npm run test -- tests/unit/domain/default-notes-group.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run typecheck for the new helper**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Stage, inspect, run GitNexus detect changes, and commit**

Run:

```bash
git add src/domain/sessions/default-notes-group.ts tests/unit/domain/default-notes-group.test.ts
git diff --cached --name-status
```

Expected staged files:

```text
A	src/domain/sessions/default-notes-group.ts
A	tests/unit/domain/default-notes-group.test.ts
```

Run GitNexus staged-change analysis with MCP:

```text
mcp__gitnexus.detect_changes({ "repo": "onetab", "scope": "staged" })
```

Then commit:

```bash
git commit -m "feat: add default notes group helper"
```

---

### Task 2: Route Single-Tab Capture To Default Notes

**Files:**
- Create: `src/features/sessions/capture/capture-browser-tab-to-default-notes-group.ts`
- Modify: `src/features/sessions/capture/capture-current-tab.ts`
- Modify: `src/features/sessions/capture/capture-browser-tab.ts`
- Modify: `tests/integration/features/capture.test.ts`

**Interfaces:**
- Consumes:
  - `DEFAULT_NOTES_GROUP_TITLE`
  - `selectDefaultNotesGroup(sessionGroups: SessionGroup[]): SessionGroup | null`
  - `appendCapturableTabToSessionGroup(sessionGroup: SessionGroup, tab: CapturableTab, now: Date): SessionGroup`
  - `createSessionGroup(tabs: CapturableTab[], options?: { now?: Date; sourceWindowId?: number | null; title?: string }): SessionGroup`
  - `prepareTabsForCapture(browserTabs: BrowserTab[]): PreparedTabsForCapture`
  - `readRootState(storage: ExtensionStorageArea): Promise<RootState>`
  - `writeRootState(storage: ExtensionStorageArea, state: RootState): Promise<void>`
  - `appendSessionGroup(storage: ExtensionStorageArea, group: SessionGroup): Promise<RootState>`
- Produces:
  - `captureBrowserTabToDefaultNotesGroup(browserTab: BrowserTab | null, dependencies: CaptureDependencies): Promise<CaptureResult>`
  - `captureCurrentTab(dependencies: CaptureDependencies): Promise<CaptureResult>` now uses the new notes flow.
  - `captureBrowserTab(browserTab: BrowserTab | null, dependencies: CaptureDependencies): Promise<CaptureResult>` now uses the new notes flow.

- [ ] **Step 1: Run required GitNexus impact checks before editing existing symbols**

Run these MCP impact calls and record the risk in the task notes:

```text
mcp__gitnexus.impact({ "repo": "onetab", "target": "captureCurrentTab", "direction": "upstream", "maxDepth": 3, "minConfidence": 0.8 })
mcp__gitnexus.impact({ "repo": "onetab", "target": "captureBrowserTab", "direction": "upstream", "maxDepth": 3, "minConfidence": 0.8 })
```

Expected: neither result is HIGH or CRITICAL. If either is HIGH or CRITICAL, stop and report before editing.

- [ ] **Step 2: Add failing integration coverage**

Modify the import block in `tests/integration/features/capture.test.ts` so it includes `writeRootState` and `SessionGroup`:

```ts
import { describe, expect, it } from "vitest";
import { DEFAULT_NOTES_GROUP_TITLE } from "../../../src/domain/sessions/default-notes-group";
import { captureBrowserTab } from "../../../src/features/sessions/capture/capture-browser-tab";
import { captureCurrentTab } from "../../../src/features/sessions/capture/capture-current-tab";
import { captureCurrentWindow } from "../../../src/features/sessions/capture/capture-current-window";
import { captureSelectedTabs } from "../../../src/features/sessions/capture/capture-selected-tabs";
import {
  readRootState,
  writeRootState,
  type ExtensionStorageArea
} from "../../../src/storage/local/repository";
import type { BrowserTab, TabsAdapter } from "../../../src/types/browser";
import type { SessionGroup } from "../../../src/types/session";
```

Replace `createMemoryStorage` with this version so write-failure behavior can be tested:

```ts
function createMemoryStorage(options?: {
  onSet?: (items: Record<string, unknown>) => Promise<void> | void;
}): ExtensionStorageArea {
  const data = new Map<string, unknown>();

  return {
    async get(key) {
      return {
        [key]: data.get(key)
      };
    },
    async set(items) {
      await options?.onSet?.(items);
      Object.entries(items).forEach(([key, value]) => data.set(key, value));
    },
    async remove(key) {
      data.delete(key);
    }
  };
}
```

Add this helper after `createTabsAdapter`:

```ts
function createStoredSessionGroup(overrides: Partial<SessionGroup>): SessionGroup {
  return {
    id: "session-default",
    title: "保存于 2026-04-19",
    createdAt: "2026-04-19T10:00:00.000Z",
    updatedAt: "2026-04-19T10:00:00.000Z",
    trashedAt: null,
    sortOrder: 10,
    tabCount: 1,
    pinned: false,
    sourceWindowId: 1,
    tabs: [
      {
        id: "tab-default",
        title: "Existing",
        url: "https://example.com/existing",
        favIconUrl: null,
        createdAt: "2026-04-19T10:00:00.000Z",
        lastOpenedAt: null,
        originalIndex: 0
      }
    ],
    ...overrides
  };
}
```

In the existing test named `should capture only the active tab for current-tab action`, add these expectations after `expect(state.sessions[0].tabs[0].url).toBe("https://example.com/b");`:

```ts
expect(state.sessions[0].title).toBe(DEFAULT_NOTES_GROUP_TITLE);
expect(result.message).toBe(`Added the current page to "${DEFAULT_NOTES_GROUP_TITLE}".`);
```

In the existing test named `should capture only the right-clicked tab when capturing a specific browser tab`, add these expectations after `expect(state.sessions[0].tabs[0].url).toBe("https://example.com/target");`:

```ts
expect(state.sessions[0].title).toBe(DEFAULT_NOTES_GROUP_TITLE);
expect(result.message).toBe(`Added the current page to "${DEFAULT_NOTES_GROUP_TITLE}".`);
```

Add these new tests inside `describe("capture feature", () => { ... })`:

```ts
it("should reuse an existing active notes group for current-tab capture", async () => {
  const storage = createMemoryStorage();
  const rootState = await readRootState(storage);
  rootState.sessions = [
    createStoredSessionGroup({
      id: "session-notes",
      title: DEFAULT_NOTES_GROUP_TITLE,
      sortOrder: 1,
      updatedAt: "2026-04-19T10:00:00.000Z",
      tabCount: 1,
      tabs: [
        {
          id: "tab-existing",
          title: "Existing",
          url: "https://example.com/existing",
          favIconUrl: null,
          createdAt: "2026-04-19T10:00:00.000Z",
          lastOpenedAt: null,
          originalIndex: 2
        }
      ]
    })
  ];
  await writeRootState(storage, rootState);
  let closedTabIds: number[] = [];
  const tabs = createTabsAdapter(
    [
      {
        id: 61,
        windowId: 6,
        index: 3,
        title: "Added",
        url: "https://example.com/added",
        active: true
      }
    ],
    {
      onClose(tabIds) {
        closedTabIds = tabIds;
      }
    }
  );

  const result = await captureCurrentTab({
    storage,
    tabs,
    now: () => new Date("2026-04-20T09:15:00.000Z")
  });

  const state = await readRootState(storage);

  expect(result.ok).toBe(true);
  expect(result.createdGroupId).toBe("session-notes");
  expect(closedTabIds).toEqual([61]);
  expect(state.sessions).toHaveLength(1);
  expect(state.sessions[0].id).toBe("session-notes");
  expect(state.sessions[0].tabCount).toBe(2);
  expect(state.sessions[0].updatedAt).toBe("2026-04-20T09:15:00.000Z");
  expect(state.sessions[0].tabs.map((tab) => tab.url)).toEqual([
    "https://example.com/existing",
    "https://example.com/added"
  ]);
  expect(state.sessions[0].tabs[1].originalIndex).toBe(3);
});

it("should create a new active notes group when only a trashed notes group exists", async () => {
  const storage = createMemoryStorage();
  const rootState = await readRootState(storage);
  rootState.sessions = [
    createStoredSessionGroup({
      id: "session-notes-trashed",
      title: DEFAULT_NOTES_GROUP_TITLE,
      trashedAt: "2026-04-19T12:00:00.000Z"
    })
  ];
  await writeRootState(storage, rootState);
  const tabs = createTabsAdapter([
    {
      id: 71,
      windowId: 7,
      index: 0,
      title: "Fresh",
      url: "https://example.com/fresh",
      active: true
    }
  ]);

  const result = await captureCurrentTab({
    storage,
    tabs,
    now: () => new Date("2026-04-20T11:00:00.000Z")
  });

  const state = await readRootState(storage);
  const activeNotesGroup = state.sessions.find(
    (session) => session.title === DEFAULT_NOTES_GROUP_TITLE && !session.trashedAt
  );
  const trashedNotesGroup = state.sessions.find(
    (session) => session.id === "session-notes-trashed"
  );

  expect(result.createdGroupId).toBe("session_1776682800000");
  expect(state.sessions).toHaveLength(2);
  expect(activeNotesGroup?.tabs.map((tab) => tab.url)).toEqual([
    "https://example.com/fresh"
  ]);
  expect(trashedNotesGroup?.trashedAt).toBe("2026-04-19T12:00:00.000Z");
});

it("should keep the original tab open when notes capture storage write fails", async () => {
  const storage = createMemoryStorage({
    onSet() {
      throw new Error("write failed");
    }
  });
  let closedTabIds: number[] = [];
  const tabs = createTabsAdapter([], {
    onClose(tabIds) {
      closedTabIds = tabIds;
    }
  });

  await expect(
    captureBrowserTab(
      {
        id: 81,
        windowId: 8,
        index: 0,
        title: "Write Failure",
        url: "https://example.com/write-failure"
      },
      {
        storage,
        tabs,
        now: () => new Date("2026-04-20T12:00:00.000Z")
      }
    )
  ).rejects.toThrow("write failed");

  expect(closedTabIds).toEqual([]);
});
```

- [ ] **Step 3: Run focused integration tests to verify they fail**

Run:

```bash
npm run test -- tests/integration/features/capture.test.ts
```

Expected: FAIL. The current implementation still creates `保存于 YYYY-MM-DD` groups for single-tab capture.

- [ ] **Step 4: Implement the single-tab default notes use case**

Create `src/features/sessions/capture/capture-browser-tab-to-default-notes-group.ts`:

```ts
import { createSessionGroup } from "../../../domain/sessions/create-session-group";
import {
  appendCapturableTabToSessionGroup,
  DEFAULT_NOTES_GROUP_TITLE,
  selectDefaultNotesGroup
} from "../../../domain/sessions/default-notes-group";
import { prepareTabsForCapture } from "../../../domain/tabs/prepare-tabs-for-capture";
import {
  appendSessionGroup,
  readRootState,
  writeRootState
} from "../../../storage/local/repository";
import type { BrowserTab } from "../../../types/browser";
import type { CapturableTab, SessionGroup } from "../../../types/session";
import type { CaptureDependencies, CaptureResult } from "./capture-tabs";

function buildDefaultNotesCaptureMessage(result: {
  capturedCount: number;
  skippedCount: number;
  closeFailed: boolean;
  targetTitle: string;
}): string {
  if (result.capturedCount === 0) {
    if (result.skippedCount > 0) {
      return `Skipped ${result.skippedCount} unsupported tab(s); nothing was captured.`;
    }

    return "No tabs were available to capture.";
  }

  if (result.closeFailed) {
    return `Added the current page to "${result.targetTitle}", but failed to close the original tab.`;
  }

  return `Added the current page to "${result.targetTitle}".`;
}

async function upsertDefaultNotesGroup(
  capturableTab: CapturableTab,
  sourceWindowId: number | null,
  dependencies: CaptureDependencies,
  now: Date
): Promise<SessionGroup> {
  const state = await readRootState(dependencies.storage);
  const existingNotesGroup = selectDefaultNotesGroup(state.sessions);

  if (existingNotesGroup) {
    const updatedNotesGroup = appendCapturableTabToSessionGroup(
      existingNotesGroup,
      capturableTab,
      now
    );

    await writeRootState(dependencies.storage, {
      ...state,
      sessions: state.sessions.map((sessionGroup) =>
        sessionGroup.id === updatedNotesGroup.id ? updatedNotesGroup : sessionGroup
      )
    });

    return updatedNotesGroup;
  }

  const createdNotesGroup = createSessionGroup([capturableTab], {
    now,
    sourceWindowId,
    title: DEFAULT_NOTES_GROUP_TITLE
  });

  const nextState = await appendSessionGroup(dependencies.storage, createdNotesGroup);
  return (
    nextState.sessions.find((sessionGroup) => sessionGroup.id === createdNotesGroup.id) ??
    createdNotesGroup
  );
}

export async function captureBrowserTabToDefaultNotesGroup(
  browserTab: BrowserTab | null,
  dependencies: CaptureDependencies
): Promise<CaptureResult> {
  const preparedTabs = prepareTabsForCapture(browserTab ? [browserTab] : []);

  if (!browserTab || preparedTabs.capturableTabs.length === 0) {
    return {
      ok: true,
      message: buildDefaultNotesCaptureMessage({
        capturedCount: 0,
        skippedCount: preparedTabs.skippedTabs.length,
        closeFailed: false,
        targetTitle: DEFAULT_NOTES_GROUP_TITLE
      }),
      createdGroupId: null,
      capturedCount: 0,
      skippedCount: preparedTabs.skippedTabs.length,
      closedCount: 0
    };
  }

  const now = dependencies.now?.() ?? new Date();
  const targetSession = await upsertDefaultNotesGroup(
    preparedTabs.capturableTabs[0],
    preparedTabs.sourceWindowId,
    dependencies,
    now
  );
  let closeFailed = false;

  try {
    await dependencies.tabs.closeTabs(preparedTabs.closableTabIds);
  } catch {
    closeFailed = true;
  }

  return {
    ok: !closeFailed,
    message: buildDefaultNotesCaptureMessage({
      capturedCount: 1,
      skippedCount: 0,
      closeFailed,
      targetTitle: targetSession.title
    }),
    createdGroupId: targetSession.id,
    capturedCount: 1,
    skippedCount: 0,
    closedCount: closeFailed ? 0 : preparedTabs.closableTabIds.length
  };
}
```

Replace `src/features/sessions/capture/capture-current-tab.ts` with:

```ts
import type { CaptureDependencies, CaptureResult } from "./capture-tabs";
import { captureBrowserTabToDefaultNotesGroup } from "./capture-browser-tab-to-default-notes-group";

export async function captureCurrentTab(
  dependencies: CaptureDependencies
): Promise<CaptureResult> {
  const activeTab = await dependencies.tabs.getActiveTab();
  return captureBrowserTabToDefaultNotesGroup(activeTab, dependencies);
}
```

Replace `src/features/sessions/capture/capture-browser-tab.ts` with:

```ts
import type { BrowserTab } from "../../../types/browser";
import type { CaptureDependencies, CaptureResult } from "./capture-tabs";
import { captureBrowserTabToDefaultNotesGroup } from "./capture-browser-tab-to-default-notes-group";

export async function captureBrowserTab(
  browserTab: BrowserTab | null,
  dependencies: CaptureDependencies
): Promise<CaptureResult> {
  return captureBrowserTabToDefaultNotesGroup(browserTab, dependencies);
}
```

- [ ] **Step 5: Run focused integration tests to verify they pass**

Run:

```bash
npm run test -- tests/integration/features/capture.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run the domain unit test again**

Run:

```bash
npm run test -- tests/unit/domain/default-notes-group.test.ts
```

Expected: PASS.

- [ ] **Step 7: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 8: Stage, inspect, run GitNexus detect changes, and commit**

Run:

```bash
git add \
  src/features/sessions/capture/capture-browser-tab-to-default-notes-group.ts \
  src/features/sessions/capture/capture-current-tab.ts \
  src/features/sessions/capture/capture-browser-tab.ts \
  tests/integration/features/capture.test.ts
git diff --cached --name-status
```

Expected staged files:

```text
A	src/features/sessions/capture/capture-browser-tab-to-default-notes-group.ts
M	src/features/sessions/capture/capture-current-tab.ts
M	src/features/sessions/capture/capture-browser-tab.ts
M	tests/integration/features/capture.test.ts
```

Run GitNexus staged-change analysis with MCP:

```text
mcp__gitnexus.detect_changes({ "repo": "onetab", "scope": "staged" })
```

Then commit:

```bash
git commit -m "feat: save single tabs to notes group"
```

---

### Task 3: Update Runtime Flow Docs And Run Quality Gates

**Files:**
- Modify: `docs/architecture/runtime-flows.md`

**Interfaces:**
- Consumes:
  - Behavior from Task 2.
- Produces:
  - Documentation that matches default notes capture behavior.

- [ ] **Step 1: Update runtime flow documentation**

In `docs/architecture/runtime-flows.md`, replace the `## 3. Capture Current Tab` section with:

```md
## 3. Capture Current Tab

### Flow

1. 获取当前活动标签
2. 判断 URL 是否支持
3. 读取 root state
4. 查找未删除的默认 `笔记` 分组
5. 若存在默认 `笔记` 分组，则追加当前标签并更新 `tabCount`、`updatedAt`
6. 若不存在默认 `笔记` 分组，则创建标题为 `笔记` 的普通分组
7. 写入 root state 成功后关闭该标签

### Failure Handling

- 若当前标签不支持收纳，则直接反馈，不创建 `笔记` 分组
- 写入失败时绝不能关闭标签
- 关闭标签失败时返回部分成功结果，并保留已写入的 `笔记` 分组内容
```

In the `## 4.1 Send Page To Existing Group` section, replace the Flow list with:

```md
1. Background 注册页面右键菜单
2. 固定分组来自 `pinned === true` 的 active sessions，不受最近分组数量限制
3. 最近分组来自非固定 active sessions，并按配置数量限制
4. 用户在页面右键菜单中选择固定分组或最近分组
5. feature 将当前页面追加到用户显式选择的目标组，随后尝试关闭原标签
```

Add this bullet under `### Data Rule` in the same section:

```md
- 未显式选择固定分组或最近分组的单页 capture 默认写入 `笔记` 分组；批量 capture 仍使用自动日期分组
```

- [ ] **Step 2: Run full local quality gates**

Run:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Expected: all commands PASS.

- [ ] **Step 3: Run E2E only if Task 2 changed browser context-menu wiring**

Task 2 should not modify `src/background/service-worker.ts`. If that file remains untouched, skip E2E and record: "Skipped `npm run test:e2e` because service-worker context-menu wiring was not changed."

If `src/background/service-worker.ts` was modified during implementation, run:

```bash
npm run test:e2e
```

Expected: PASS.

- [ ] **Step 4: Stage, inspect, run GitNexus detect changes, and commit docs**

Run:

```bash
git add docs/architecture/runtime-flows.md
git diff --cached --name-status
```

Expected staged files:

```text
M	docs/architecture/runtime-flows.md
```

Run GitNexus staged-change analysis with MCP:

```text
mcp__gitnexus.detect_changes({ "repo": "onetab", "scope": "staged" })
```

Then commit:

```bash
git commit -m "docs: update notes capture flow"
```

- [ ] **Step 5: Final changed-scope audit**

Run:

```bash
git status --short
```

Expected: only pre-existing unrelated working-tree changes remain, if any. The files touched by this plan should be committed.

Run GitNexus all-change analysis with MCP:

```text
mcp__gitnexus.detect_changes({ "repo": "onetab", "scope": "all" })
```

Expected: changed symbols and affected flows are limited to default notes capture work plus any pre-existing unrelated user changes already present before this plan.

---

## Self-Review Notes

- Spec coverage: the plan covers default `笔记` creation/reuse, explicit Fixed Groups / Recent Groups preservation, bulk date grouping preservation, failure handling, tests, docs, and no schema changes.
- Placeholder scan: no placeholder markers or vague test instructions are intentionally left in this plan.
- Type consistency: `CaptureDependencies` and `CaptureResult` remain sourced from `capture-tabs.ts`; the new helper returns `SessionGroup | null` for selector and `SessionGroup` for append.
