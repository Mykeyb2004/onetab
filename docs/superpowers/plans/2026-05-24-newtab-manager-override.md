# New Tab Manager Override Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a lightweight `newtab.html` override page that becomes TabVault's default browser entry shell, supports quick restore actions, and deep-links into the existing manager without disturbing current capture/restore flows.

**Architecture:** Register a dedicated `newtab.html` override in Manifest V3 instead of reusing `manager.html` directly. Keep the new tab page light by loading a minimal session summary view from a small feature module, render restore and navigation actions in a focused UI layer, and keep full editing inside the existing manager page. Use a query-parameter deep link to focus manager on a selected session rather than expanding background/runtime message surface area.

**Tech Stack:** TypeScript, React 19, Vite, Manifest V3, Vitest, Playwright

---

## File Structure

- Create: `newtab.html`
  - Dedicated HTML entry for the Chrome `newtab` override.
- Create: `src/domain/sessions/select-newtab-session-summaries.ts`
  - Pure selector that turns active `SessionGroup[]` input into pinned/recent summary cards for the new tab UI.
- Create: `src/features/newtab/load-newtab-page-state.ts`
  - Lightweight storage-backed loader for `newtab` page state.
- Create: `src/ui/newtab/main.tsx`
  - React bootstrap for the new tab page.
- Create: `src/ui/newtab/App.tsx`
  - New tab shell UI, restore action wiring, and deep-link navigation to manager/options.
- Create: `src/ui/newtab/newtab.css`
  - New-tab-specific layout and card styles.
- Create: `tests/unit/domain/select-newtab-session-summaries.test.ts`
  - Unit coverage for new tab summary selection logic.
- Create: `tests/integration/features/load-newtab-page-state.test.ts`
  - Integration coverage for storage-backed new tab state loading.
- Create: `tests/e2e/newtab-workflows.spec.ts`
  - Browser-backed workflows for the new tab shell.
- Create: `docs/adr/adr-006-newtab-override-shell.md`
  - ADR for static override + shell-page decision.
- Modify: `public/manifest.json`
  - Register `chrome_url_overrides.newtab`.
- Modify: `vite.config.ts`
  - Add `newtab.html` as a Vite build input.
- Modify: `src/ui/manager/App.tsx`
  - Honor `?session=<id>` deep links when opening manager from the new tab summary cards.
- Modify: `tests/e2e/extension-shell.spec.ts`
  - Add a smoke test for the override page.
- Modify: `docs/onetab-like-extension-prd.md`
  - Document `newtab` as the browser-level default shell.
- Modify: `docs/architecture/runtime-flows.md`
  - Add the new tab runtime flow.
- Modify: `docs/architecture/permissions-and-security.md`
  - Document static override limitations and user expectations.

## Task 1: Wire the Static New Tab Override Shell

**Files:**
- Create: `newtab.html`
- Create: `src/ui/newtab/main.tsx`
- Create: `src/ui/newtab/App.tsx`
- Modify: `public/manifest.json`
- Modify: `vite.config.ts`
- Modify: `tests/e2e/extension-shell.spec.ts`

- [ ] **Step 1: Write the failing E2E smoke test for the new tab shell**

```ts
import { expect, test } from "./extension-harness";

test.skip(
  !process.env.RUN_EXTENSION_E2E,
  "Set RUN_EXTENSION_E2E=1 when running browser-backed extension E2E on a machine with Chrome access."
);

test("loads popup, manager, and newtab pages for the unpacked extension", async ({
  context,
  extensionId
}) => {
  const popupPage = await context.newPage();
  await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);

  await expect(popupPage.getByRole("heading", { name: "TabVault" })).toBeVisible();
  await expect(popupPage.getByRole("button", { name: "Capture Current Window" })).toBeVisible();

  const managerPage = await context.newPage();
  await managerPage.goto(`chrome-extension://${extensionId}/manager.html`);

  await expect(managerPage.getByRole("heading", { name: "Session Manager" })).toBeVisible();
  await expect(managerPage.getByLabel("Search group name, tab title, or URL")).toBeVisible();

  const newTabPage = await context.newPage();
  await newTabPage.goto("chrome://newtab/");

  await expect(newTabPage.getByRole("heading", { name: "New Tab" })).toBeVisible();
  await expect(newTabPage.getByRole("button", { name: "Open Manager" })).toBeVisible();
});
```

- [ ] **Step 2: Run the Playwright smoke test and verify it fails before the override exists**

Run:

```bash
npm run build && RUN_EXTENSION_E2E=1 npx playwright test tests/e2e/extension-shell.spec.ts -g "loads popup, manager, and newtab pages"
```

Expected: FAIL because `chrome://newtab/` still shows the browser default page instead of a TabVault heading.

- [ ] **Step 3: Add the minimal override entry, Vite input, and shell UI**

```html
<!-- newtab.html -->
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>TabVault New Tab</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/ui/newtab/main.tsx"></script>
  </body>
</html>
```

```ts
// vite.config.ts
input: {
  popup: resolve(rootDir, "popup.html"),
  newtab: resolve(rootDir, "newtab.html"),
  manager: resolve(rootDir, "manager.html"),
  options: resolve(rootDir, "options.html"),
  help: resolve(rootDir, "help.html"),
  background: resolve(rootDir, "src/background/service-worker.ts")
},
```

```json
// public/manifest.json
{
  "manifest_version": 3,
  "name": "TabVault",
  "version": "0.1.0",
  "description": "Local-first tab capture and restore for Chrome.",
  "action": {
    "default_title": "TabVault",
    "default_popup": "popup.html"
  },
  "background": {
    "service_worker": "assets/background.js",
    "type": "module"
  },
  "chrome_url_overrides": {
    "newtab": "newtab.html"
  },
  "options_page": "options.html",
  "permissions": ["tabs", "storage", "contextMenus", "notifications"],
  "commands": {
    "capture-current-window": {
      "suggested_key": {
        "default": "Alt+Shift+1",
        "mac": "Option+Shift+1"
      },
      "description": "Capture tabs from the current window"
    },
    "open-manager": {
      "suggested_key": {
        "default": "Alt+Shift+2",
        "mac": "Option+Shift+2"
      },
      "description": "Open the TabVault manager"
    }
  }
}
```

```tsx
// src/ui/newtab/App.tsx
import { AppShell } from "../shared/AppShell";

export function NewTabApp() {
  return (
    <AppShell eyebrow="Browser Entry" title="New Tab" description="Start from TabVault or jump into the full manager.">
      <div className="card stack">
        <div className="inline-actions">
          <button className="button" type="button">
            Open Manager
          </button>
          <button className="button button--secondary" type="button">
            Open Settings
          </button>
        </div>
      </div>
    </AppShell>
  );
}
```

```tsx
// src/ui/newtab/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { NewTabApp } from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <NewTabApp />
  </React.StrictMode>
);
```

- [ ] **Step 4: Re-run the Playwright smoke test and verify the override loads**

Run:

```bash
npm run build && RUN_EXTENSION_E2E=1 npx playwright test tests/e2e/extension-shell.spec.ts -g "loads popup, manager, and newtab pages"
```

Expected: PASS, and `chrome://newtab/` renders the extension shell with the `New Tab` heading.

- [ ] **Step 5: Run GitNexus change detection before committing**

Use:

```text
gitnexus_detect_changes({ repo: "onetab", scope: "all" })
```

Expected: only `public/manifest.json`, `vite.config.ts`, `newtab.html`, `src/ui/newtab/*`, and `tests/e2e/extension-shell.spec.ts` appear in scope.

- [ ] **Step 6: Commit the shell wiring**

```bash
git add public/manifest.json vite.config.ts newtab.html src/ui/newtab/main.tsx src/ui/newtab/App.tsx tests/e2e/extension-shell.spec.ts
git commit -m "feat: add new tab override shell"
```

## Task 2: Add Pure New Tab Summary Selection and State Loading

**Files:**
- Create: `src/domain/sessions/select-newtab-session-summaries.ts`
- Create: `src/features/newtab/load-newtab-page-state.ts`
- Create: `tests/unit/domain/select-newtab-session-summaries.test.ts`
- Create: `tests/integration/features/load-newtab-page-state.test.ts`

- [ ] **Step 1: Write the failing unit and integration tests**

```ts
// tests/unit/domain/select-newtab-session-summaries.test.ts
import { describe, expect, it } from "vitest";
import { selectNewTabSessionSummaries } from "../../../src/domain/sessions/select-newtab-session-summaries";
import type { SessionGroup } from "../../../src/types/session";

function createSessionGroup(overrides: Partial<SessionGroup>): SessionGroup {
  return {
    id: "session-default",
    title: "Default Session",
    createdAt: "2026-04-19T10:00:00.000Z",
    updatedAt: "2026-04-19T10:00:00.000Z",
    trashedAt: null,
    sortOrder: 0,
    tabCount: 2,
    pinned: false,
    sourceWindowId: null,
    tabs: [
      {
        id: "tab-1",
        title: "Alpha",
        url: "https://example.com/alpha",
        favIconUrl: null,
        createdAt: "2026-04-19T10:00:00.000Z",
        lastOpenedAt: null,
        originalIndex: 0
      },
      {
        id: "tab-2",
        title: "Beta",
        url: "https://example.com/beta",
        favIconUrl: null,
        createdAt: "2026-04-19T10:00:00.000Z",
        lastOpenedAt: null,
        originalIndex: 1
      }
    ],
    ...overrides
  };
}

describe("selectNewTabSessionSummaries", () => {
  it("should keep pinned sessions separate from recent sessions and skip trashed sessions", () => {
    const result = selectNewTabSessionSummaries(
      [
        createSessionGroup({ id: "pinned-1", pinned: true, updatedAt: "2026-04-19T08:00:00.000Z" }),
        createSessionGroup({ id: "recent-1", updatedAt: "2026-04-19T12:00:00.000Z", sortOrder: 10 }),
        createSessionGroup({ id: "trash-1", trashedAt: "2026-04-19T09:00:00.000Z" }),
        createSessionGroup({ id: "recent-2", updatedAt: "2026-04-19T11:00:00.000Z", sortOrder: 20 })
      ],
      { recentLimit: 1, previewLimit: 1 }
    );

    expect(result.hasSessions).toBe(true);
    expect(result.pinnedSessions.map((session) => session.id)).toEqual(["pinned-1"]);
    expect(result.recentSessions.map((session) => session.id)).toEqual(["recent-1"]);
    expect(result.recentSessions[0].previewTabs).toEqual([
      { title: "Alpha", url: "https://example.com/alpha" }
    ]);
  });
});
```

```ts
// tests/integration/features/load-newtab-page-state.test.ts
import { describe, expect, it } from "vitest";
import { loadNewTabPageState } from "../../../src/features/newtab/load-newtab-page-state";
import { appendSessionGroup, type ExtensionStorageArea } from "../../../src/storage/local/repository";
import { createSessionGroup } from "../../../src/domain/sessions/create-session-group";

function createMemoryStorage(): ExtensionStorageArea {
  const data = new Map<string, unknown>();

  return {
    async get(key) {
      return { [key]: data.get(key) };
    },
    async set(items) {
      Object.entries(items).forEach(([key, value]) => data.set(key, value));
    },
    async remove(key) {
      data.delete(key);
    }
  };
}

describe("loadNewTabPageState", () => {
  it("should return an empty state when no sessions exist", async () => {
    const storage = createMemoryStorage();

    const result = await loadNewTabPageState({ storage });

    expect(result.hasSessions).toBe(false);
    expect(result.pinnedSessions).toEqual([]);
    expect(result.recentSessions).toEqual([]);
  });

  it("should expose recent session summaries from persisted root state", async () => {
    const storage = createMemoryStorage();
    const group = createSessionGroup(
      [{ url: "https://example.com", title: "Example", index: 0 }],
      { now: new Date(2026, 3, 19, 10, 45) }
    );

    await appendSessionGroup(storage, group);

    const result = await loadNewTabPageState({ storage, recentLimit: 3, previewLimit: 2 });

    expect(result.hasSessions).toBe(true);
    expect(result.recentSessions[0].id).toBe(group.id);
    expect(result.recentSessions[0].tabCount).toBe(1);
  });
});
```

- [ ] **Step 2: Run the unit and integration tests to verify they fail**

Run:

```bash
npm run test -- tests/unit/domain/select-newtab-session-summaries.test.ts tests/integration/features/load-newtab-page-state.test.ts
```

Expected: FAIL with missing module errors for `select-newtab-session-summaries` and `load-newtab-page-state`.

- [ ] **Step 3: Implement the selector and loader with injected storage dependencies**

```ts
// src/domain/sessions/select-newtab-session-summaries.ts
import { selectPageTargetGroups } from "./select-page-target-groups";
import type { SessionGroup } from "../../types/session";

export interface NewTabSessionPreviewTab {
  title: string;
  url: string;
}

export interface NewTabSessionSummary {
  id: string;
  title: string;
  updatedAt: string;
  tabCount: number;
  pinned: boolean;
  previewTabs: NewTabSessionPreviewTab[];
}

export interface NewTabSessionSummaryCollection {
  hasSessions: boolean;
  pinnedSessions: NewTabSessionSummary[];
  recentSessions: NewTabSessionSummary[];
}

export function selectNewTabSessionSummaries(
  sessionGroups: SessionGroup[],
  options: { recentLimit?: number; previewLimit?: number } = {}
): NewTabSessionSummaryCollection {
  const recentLimit = options.recentLimit ?? 4;
  const previewLimit = options.previewLimit ?? 3;
  const { pinnedGroups, recentGroups } = selectPageTargetGroups(sessionGroups, { recentLimit });
  const toSummary = (session: SessionGroup): NewTabSessionSummary => ({
    id: session.id,
    title: session.title,
    updatedAt: session.updatedAt,
    tabCount: session.tabCount,
    pinned: session.pinned,
    previewTabs: session.tabs.slice(0, previewLimit).map((tab) => ({
      title: tab.title,
      url: tab.url
    }))
  });

  return {
    hasSessions: pinnedGroups.length > 0 || recentGroups.length > 0,
    pinnedSessions: pinnedGroups.map(toSummary),
    recentSessions: recentGroups.map(toSummary)
  };
}
```

```ts
// src/features/newtab/load-newtab-page-state.ts
import { chromeLocalStorage } from "../../adapters/chrome/storage";
import {
  selectNewTabSessionSummaries,
  type NewTabSessionSummaryCollection
} from "../../domain/sessions/select-newtab-session-summaries";
import { readRootState, type ExtensionStorageArea } from "../../storage/local/repository";

export interface LoadNewTabPageStateDependencies {
  storage: ExtensionStorageArea;
  recentLimit?: number;
  previewLimit?: number;
}

export type NewTabPageState = NewTabSessionSummaryCollection;

export async function loadNewTabPageState(
  dependencies: LoadNewTabPageStateDependencies = {
    storage: chromeLocalStorage,
    recentLimit: 4,
    previewLimit: 3
  }
): Promise<NewTabPageState> {
  const state = await readRootState(dependencies.storage);

  return selectNewTabSessionSummaries(state.sessions, {
    recentLimit: dependencies.recentLimit,
    previewLimit: dependencies.previewLimit
  });
}
```

- [ ] **Step 4: Re-run the unit and integration tests and verify they pass**

Run:

```bash
npm run test -- tests/unit/domain/select-newtab-session-summaries.test.ts tests/integration/features/load-newtab-page-state.test.ts
```

Expected: PASS with both files green.

- [ ] **Step 5: Run GitNexus change detection before committing**

Use:

```text
gitnexus_detect_changes({ repo: "onetab", scope: "all" })
```

Expected: only the new selector, new feature, and their test files appear beyond Task 1 work.

- [ ] **Step 6: Commit the data-layer work**

```bash
git add src/domain/sessions/select-newtab-session-summaries.ts src/features/newtab/load-newtab-page-state.ts tests/unit/domain/select-newtab-session-summaries.test.ts tests/integration/features/load-newtab-page-state.test.ts
git commit -m "feat: add new tab page state loader"
```

## Task 3: Build the New Tab UI Around Quick Restore Instead of Capture

**Files:**
- Modify: `src/ui/newtab/App.tsx`
- Create: `src/ui/newtab/newtab.css`
- Create: `tests/e2e/newtab-workflows.spec.ts`

- [ ] **Step 1: Write the failing E2E workflow for empty state and quick restore**

```ts
import { expect, test } from "./extension-harness";

test.skip(
  !process.env.RUN_EXTENSION_E2E,
  "Set RUN_EXTENSION_E2E=1 when running browser-backed extension E2E on a machine with Chrome access."
);

const ROOT_STORAGE_KEY = "tabvault:root";

function createSeededSession(sessionId: string, title: string, tabCount: number) {
  return {
    id: sessionId,
    title,
    createdAt: "2026-04-19T10:00:00.000Z",
    updatedAt: "2026-04-19T10:00:00.000Z",
    trashedAt: null,
    tabCount,
    pinned: false,
    sourceWindowId: 1,
    tabs: Array.from({ length: tabCount }, (_, index) => ({
      id: `${sessionId}-tab-${index + 1}`,
      title: `${title} Tab ${index + 1}`,
      url: `https://example.com/${sessionId}/tab-${index + 1}`,
      favIconUrl: null,
      createdAt: "2026-04-19T10:00:00.000Z",
      lastOpenedAt: null,
      originalIndex: index
    }))
  };
}

async function seedNewTabState(page: import("@playwright/test").Page, sessions: unknown[]) {
  await page.goto("chrome://newtab/");
  await page.evaluate(
    async ({ storageKey, nextSessions }) => {
      await chrome.storage.local.set({
        [storageKey]: {
          schemaVersion: 1,
          settings: {
            restoreBehavior: "remove-group",
            defaultClickAction: "capture-current-window",
            showCaptureFeedback: true,
            enableContextMenu: true,
            managerGridDensityPreference: "enhanced"
          },
          sessions: nextSessions
        }
      });
    },
    { storageKey: ROOT_STORAGE_KEY, nextSessions: sessions }
  );
  await page.reload();
}

test("new tab shows an empty state before sessions exist", async ({ context }) => {
  const page = await context.newPage();
  await page.goto("chrome://newtab/");

  await expect(page.getByText("No saved sessions yet.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Open Manager" })).toBeVisible();
});

test("new tab can restore the latest session without opening manager", async ({ context }) => {
  const page = await context.newPage();
  await seedNewTabState(page, [createSeededSession("session-1", "Research Bundle", 2)]);

  await page.getByRole("button", { name: "Restore Latest Group" }).click();

  await expect(page.getByText("Restored 2 tab(s) in a new window.")).toBeVisible();
  await expect(page.getByText("Research Bundle")).not.toBeVisible();
});
```

- [ ] **Step 2: Run the new tab workflow tests and verify they fail**

Run:

```bash
npm run build && RUN_EXTENSION_E2E=1 npx playwright test tests/e2e/newtab-workflows.spec.ts
```

Expected: FAIL because the shell does not yet load state, render empty-state messaging, or restore sessions.

- [ ] **Step 3: Implement the lightweight UI with restore-first actions**

```tsx
// src/ui/newtab/App.tsx
import { useEffect, useState } from "react";
import { restoreSessionGroup } from "../../features/sessions/restore/restore-session-group";
import { loadNewTabPageState, type NewTabPageState } from "../../features/newtab/load-newtab-page-state";
import { sendRuntimeMessage, type RuntimeMessage } from "../../shared/messages";
import "./newtab.css";
import { AppShell } from "../shared/AppShell";

export function NewTabApp() {
  const [pageState, setPageState] = useState<NewTabPageState>({
    hasSessions: false,
    pinnedSessions: [],
    recentSessions: []
  });
  const [status, setStatus] = useState("Loading your saved sessions...");
  const [busyKey, setBusyKey] = useState<string | null>(null);

  async function refreshState(nextStatus?: string) {
    const nextState = await loadNewTabPageState();
    setPageState(nextState);
    setStatus(nextStatus ?? (nextState.hasSessions ? "Pick a session to restore or manage." : "No saved sessions yet."));
  }

  useEffect(() => {
    void refreshState().catch((error) => {
      setStatus(error instanceof Error ? error.message : "Failed to load saved sessions.");
    });
  }, []);

  async function runNavigationAction(type: Extract<RuntimeMessage["type"], "open/manager" | "open/options">) {
    setBusyKey(type);
    try {
      const response = await sendRuntimeMessage({ type });
      setStatus(response.message);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to open the requested page.");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleRestoreSession(sessionId: string) {
    setBusyKey(`restore:${sessionId}`);
    try {
      const result = await restoreSessionGroup(sessionId);
      await refreshState(result.message);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to restore the selected session.");
    } finally {
      setBusyKey(null);
    }
  }

  const latestSession = pageState.recentSessions[0] ?? pageState.pinnedSessions[0] ?? null;

  return (
    <AppShell
      eyebrow="Browser Entry"
      title="New Tab"
      description="Jump back into your saved sessions without opening the full manager."
      headerActions={
        <div className="inline-actions">
          <button className="button button--secondary button--small" type="button" disabled={busyKey !== null} onClick={() => runNavigationAction("open/manager")}>
            Open Manager
          </button>
          <button className="button button--quiet button--small" type="button" disabled={busyKey !== null} onClick={() => runNavigationAction("open/options")}>
            Settings
          </button>
        </div>
      }
    >
      <div className="card stack status">
        <strong>Status</strong>
        <p className="muted">{status}</p>
      </div>

      {latestSession ? (
        <div className="card stack">
          <strong>Quick Restore</strong>
          <button className="button" type="button" disabled={busyKey !== null} onClick={() => handleRestoreSession(latestSession.id)}>
            {busyKey === `restore:${latestSession.id}` ? "Working..." : "Restore Latest Group"}
          </button>
        </div>
      ) : null}

      {!pageState.hasSessions ? (
        <div className="card stack">
          <strong>No saved sessions yet.</strong>
          <p className="muted">Open the manager to start capturing and organizing tabs.</p>
        </div>
      ) : (
        <div className="newtab-session-columns">
          {[["Pinned Sessions", pageState.pinnedSessions], ["Recent Sessions", pageState.recentSessions]] as const}.map(([heading, sessions]) =>
            sessions.length > 0 ? (
              <section key={heading} className="card stack">
                <strong>{heading}</strong>
                <ul className="list">
                  {sessions.map((session) => (
                    <li key={session.id} className="list__item list__item--session">
                      <div className="session-card__header">
                        <div>
                          <strong>{session.title}</strong>
                          <p className="session-card__meta muted">{session.tabCount} saved tab(s)</p>
                        </div>
                        <button className="button button--secondary button--small" type="button" disabled={busyKey !== null} onClick={() => handleRestoreSession(session.id)}>
                          Restore
                        </button>
                      </div>
                      <ul className="list">
                        {session.previewTabs.map((tab) => (
                          <li key={tab.url} className="list__item">
                            <span className="tab-row__title">{tab.title}</span>
                            <span className="tab-row__url muted">{tab.url}</span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null
          )}
        </div>
      )}
    </AppShell>
  );
}
```

```css
/* src/ui/newtab/newtab.css */
.newtab-session-columns {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
}

.newtab-session-columns .list {
  gap: 12px;
}

.newtab-session-columns .list__item--session {
  gap: 14px;
}
```

- [ ] **Step 4: Re-run the new tab workflow tests and verify they pass**

Run:

```bash
npm run build && RUN_EXTENSION_E2E=1 npx playwright test tests/e2e/newtab-workflows.spec.ts -g "new tab"
```

Expected: PASS for both the empty state and quick restore flows.

- [ ] **Step 5: Run GitNexus change detection before committing**

Use:

```text
gitnexus_detect_changes({ repo: "onetab", scope: "all" })
```

Expected: new tab UI files and `restore-session-group` call sites appear, with no unexpected impact outside the UI/session restore path.

- [ ] **Step 6: Commit the new tab UI**

```bash
git add src/ui/newtab/App.tsx src/ui/newtab/newtab.css tests/e2e/newtab-workflows.spec.ts
git commit -m "feat: add new tab restore shell"
```

## Task 4: Deep-Link the Manager From New Tab Session Cards

**Files:**
- Modify: `src/ui/newtab/App.tsx`
- Modify: `src/ui/manager/App.tsx`
- Modify: `tests/e2e/newtab-workflows.spec.ts`

- [ ] **Step 1: Extend the failing E2E workflow to verify session deep linking**

```ts
test("new tab session cards open manager focused on the selected session", async ({ context }) => {
  const page = await context.newPage();
  await seedNewTabState(page, [
    createSeededSession("session-1", "Alpha Bundle", 2),
    createSeededSession("session-2", "Beta Bundle", 3)
  ]);

  await page.getByRole("button", { name: "Manage Beta Bundle" }).click();

  await expect(page).toHaveURL(/manager\.html\?session=session-2$/);
  await expect(page.getByText("Beta Bundle Tab 1")).toBeVisible();
  await expect(page.getByText("Alpha Bundle Tab 1")).not.toBeVisible();
});
```

- [ ] **Step 2: Run the deep-link E2E and verify it fails**

Run:

```bash
npm run build && RUN_EXTENSION_E2E=1 npx playwright test tests/e2e/newtab-workflows.spec.ts -g "open manager focused"
```

Expected: FAIL because no manage button exists yet and manager ignores the `session` query parameter.

- [ ] **Step 3: Add the manage button and make manager honor `?session=`**

```tsx
// src/ui/newtab/App.tsx
function openManagerForSession(sessionId: string) {
  window.location.assign(chrome.runtime.getURL(`manager.html?session=${encodeURIComponent(sessionId)}`));
}

// inside each session card action row
<div className="inline-actions">
  <button className="button button--secondary button--small" type="button" disabled={busyKey !== null} onClick={() => handleRestoreSession(session.id)}>
    Restore
  </button>
  <button className="button button--quiet button--small" type="button" disabled={busyKey !== null} onClick={() => openManagerForSession(session.id)}>
    {`Manage ${session.title}`}
  </button>
</div>
```

```tsx
// src/ui/manager/App.tsx
function readPreferredSessionIdFromLocation(search: string): string | null {
  const sessionId = new URLSearchParams(search).get("session");
  return sessionId && sessionId.trim().length > 0 ? sessionId : null;
}

export function ManagerApp() {
  const preferredSessionIdRef = useRef<string | null>(readPreferredSessionIdFromLocation(window.location.search));

  useEffect(() => {
    let alive = true;

    Promise.all([listSessionGroups(), loadExtensionSettings()])
      .then(([collections, settings]) => {
        if (!alive) {
          return;
        }

        const nextSelection = buildSelection(
          collections,
          "active",
          preferredSessionIdRef.current
        );

        setSessionCollections(collections);
        setSelectedBucket(nextSelection.bucket);
        setSelectedSessionId(nextSelection.sessionId);
        setDensityPreference(settings.managerGridDensityPreference);
        preferredSessionIdRef.current = null;
        setStatus(
          `已加载 ${collections.activeSessions.length} 个分组，回收站中有 ${collections.trashedSessions.length} 个分组。`
        );
      })
      .catch((nextError: unknown) => {
        if (!alive) {
          return;
        }

        setError(
          nextError instanceof Error
            ? nextError.message
            : "无法从本地存储中读取 TabVault 分组。"
        );
        setStatus("加载 Session Manager 失败。");
      });

    return () => {
      alive = false;
    };
  }, []);
}
```

- [ ] **Step 4: Re-run the deep-link E2E and verify it passes**

Run:

```bash
npm run build && RUN_EXTENSION_E2E=1 npx playwright test tests/e2e/newtab-workflows.spec.ts -g "open manager focused"
```

Expected: PASS, with the page navigating to `manager.html?session=session-2` and showing the targeted session as the selected manager context.

- [ ] **Step 5: Run GitNexus change detection before committing**

Use:

```text
gitnexus_detect_changes({ repo: "onetab", scope: "all" })
```

Expected: only `src/ui/newtab/App.tsx`, `src/ui/manager/App.tsx`, and `tests/e2e/newtab-workflows.spec.ts` expand beyond previous tasks.

- [ ] **Step 6: Commit the deep-linking behavior**

```bash
git add src/ui/newtab/App.tsx src/ui/manager/App.tsx tests/e2e/newtab-workflows.spec.ts
git commit -m "feat: deep link manager from new tab"
```

## Task 5: Update ADR and Product / Architecture Docs

**Files:**
- Create: `docs/adr/adr-006-newtab-override-shell.md`
- Modify: `docs/onetab-like-extension-prd.md`
- Modify: `docs/architecture/runtime-flows.md`
- Modify: `docs/architecture/permissions-and-security.md`

- [ ] **Step 1: Write the failing doc checklist inside the plan and compare it to the current docs**

```md
- PRD still says popup + manager are the only user-facing surfaces.
- Runtime flows do not describe the new tab shell.
- Permissions doc does not explain static override limitations or incognito non-support.
- No ADR records why the team chose `newtab.html` instead of reusing `manager.html`.
```

- [ ] **Step 2: Confirm the docs are still missing the new tab decisions**

Run:

```bash
rg -n "newtab|new tab|chrome_url_overrides|incognito" docs/onetab-like-extension-prd.md docs/architecture/runtime-flows.md docs/architecture/permissions-and-security.md docs/adr
```

Expected: existing matches should be absent or incomplete for the new override shell design.

- [ ] **Step 3: Write the ADR and update the supporting docs**

```md
# ADR-006 New Tab Override Shell

- Status: Accepted
- Date: 2026-05-24

## Context

TabVault needs a browser-level default entry point, but `manager.html` is a full workbench with heavier state and editing behavior than a new tab page should carry.

Chrome supports `chrome_url_overrides.newtab`, but it is a static Manifest capability rather than a runtime-toggle feature.

## Decision

- Register a dedicated `newtab.html` shell page through `chrome_url_overrides.newtab`.
- Keep `manager.html` as the full management workbench.
- Do not provide a runtime on/off toggle for the override.
- Use quick restore actions and manager deep links instead of capture actions that would target the unsupported extension page itself.

## Consequences

- The extension becomes the default new tab surface after installation.
- Incognito does not inherit the override behavior.
- Product and architecture docs must explain the static override boundary clearly.
```

```md
<!-- docs/onetab-like-extension-prd.md -->
- 浏览器工具栏图标：承载高频一键操作
- Popup 弹窗：提供快捷操作入口
- 新标签页壳：作为浏览器级默认入口，承载快速恢复与跳转
- Session Manager 页面：提供完整的收纳列表管理能力
```

```md
<!-- docs/architecture/runtime-flows.md -->
## 1.1 New Tab Entry Shell

### Flow

1. 用户打开浏览器新标签页或新窗口首个页
2. Chrome 通过 `chrome_url_overrides.newtab` 加载 `newtab.html`
3. new tab 页面读取最小会话摘要
4. 用户可直接恢复最近分组，或跳转到 manager / settings

### Failure Handling

- 如果本地状态读取失败，new tab 页面显示降级提示，不影响后续打开 manager
```

```md
<!-- docs/architecture/permissions-and-security.md -->
### `chrome_url_overrides.newtab`

用途：

- 将 TabVault 的 `newtab.html` 作为浏览器默认新标签页入口壳

限制：

- 由 Manifest 静态声明控制，不能通过运行时设置关闭
- 在 incognito 中不生效
- 不应用于普通网页导航劫持
```

- [ ] **Step 4: Re-run the doc search and verify the new terms are present**

Run:

```bash
rg -n "newtab|new tab|chrome_url_overrides|incognito" docs/onetab-like-extension-prd.md docs/architecture/runtime-flows.md docs/architecture/permissions-and-security.md docs/adr/adr-006-newtab-override-shell.md
```

Expected: matches appear in all four updated documents.

- [ ] **Step 5: Run GitNexus change detection before committing**

Use:

```text
gitnexus_detect_changes({ repo: "onetab", scope: "all" })
```

Expected: no affected execution flows, only docs and ADR files added to the change set.

- [ ] **Step 6: Commit the documentation updates**

```bash
git add docs/adr/adr-006-newtab-override-shell.md docs/onetab-like-extension-prd.md docs/architecture/runtime-flows.md docs/architecture/permissions-and-security.md
git commit -m "docs: document new tab override shell"
```

## Task 6: Run the Full Verification Stack

**Files:**
- Verify only

- [ ] **Step 1: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS with no ESLint errors.

- [ ] **Step 2: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS with no TypeScript errors.

- [ ] **Step 3: Run unit and integration tests**

Run:

```bash
npm run test
```

Expected: PASS, including the new selector and page-state coverage.

- [ ] **Step 4: Run browser-backed E2E because this touches a main user entry path**

Run:

```bash
RUN_EXTENSION_E2E=1 npm run test:e2e
```

Expected: PASS for the new tab shell smoke tests and the new tab workflow tests, in addition to the existing extension flows.

- [ ] **Step 5: Run a final production build**

Run:

```bash
npm run build
```

Expected: PASS and `dist/` contains `newtab.html` plus its `assets/newtab.js` bundle.

- [ ] **Step 6: Run the final GitNexus scope check and inspect git status**

Use:

```text
gitnexus_detect_changes({ repo: "onetab", scope: "all" })
```

Run:

```bash
git status --short
```

Expected: only the planned new tab, manager deep-link, test, and documentation files are modified or newly created.
