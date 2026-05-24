# Manager Sticky Sidebar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the left session-group sidebar stay visible while the right tab list grows long, so users can still drag tabs across groups without scrolling back to the top.

**Architecture:** Keep the existing drag-and-drop data flow intact and solve the issue at the layout layer. The manager page stays a two-column workbench on desktop, with the left sidebar pinned via sticky positioning and the right detail area turned into an independent scroll container. Add one browser-backed E2E regression that proves the main panel scrolls while the sidebar remains visible.

**Tech Stack:** React 19, TypeScript, Vite, shared CSS in `src/ui/shared/app-shell.css`, Playwright extension E2E in `tests/e2e/manager-workflows.spec.ts`

---

## File Map

- Modify: `src/ui/shared/app-shell.css`
  - Add the flex/overflow constraints needed for a nested scroll layout.
  - Make `.manager-sidebar` sticky on desktop and revert to normal flow on small screens.
  - Make `.manager-main` independently scrollable.
- Modify: `tests/e2e/manager-workflows.spec.ts`
  - Add a long-list fixture helper and a regression test for sticky sidebar visibility while the main column scrolls.
- Keep unchanged unless implementation proves necessary: `src/ui/manager/App.tsx`
  - Current DOM structure already exposes `.manager-sidebar` and `.manager-main`; do not add wrappers unless CSS alone cannot express the layout.

### Task 1: Add a failing browser-backed regression for the long-list layout

**Files:**
- Modify: `tests/e2e/manager-workflows.spec.ts`
- Test: `tests/e2e/manager-workflows.spec.ts`

- [ ] **Step 1: Extend the seeding helper and add a long-list regression test**

```ts
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

async function seedManagerState(
  extensionId: string,
  managerPage: import("@playwright/test").Page,
  sessions = [createSeededSession("session-1", "Research Bundle", 2)]
) {
  await managerPage.goto(`chrome-extension://${extensionId}/manager.html`);
  await managerPage.evaluate(async ([storageKey, nextSessions]) => {
    await chrome.storage.local.set({
      [storageKey]: {
        schemaVersion: 1,
        settings: {
          restoreBehavior: "remove-group",
          defaultClickAction: "capture-current-window",
          showCaptureFeedback: true,
          enableContextMenu: true
        },
        sessions: nextSessions
      }
    });
  }, [ROOT_STORAGE_KEY, sessions]);

  await managerPage.reload();
}

test("manager keeps the sidebar visible while the tab list scrolls", async ({
  context,
  extensionId
}) => {
  const managerPage = await context.newPage();
  await seedManagerState(extensionId, managerPage, [
    createSeededSession("session-1", "Long Session", 40),
    createSeededSession("session-2", "Drop Target", 3)
  ]);

  const sidebar = managerPage.locator(".manager-sidebar");
  const main = managerPage.locator(".manager-main");
  const targetSession = managerPage.locator("#session-node-session-2");

  const beforeSidebarBox = await sidebar.boundingBox();
  expect(beforeSidebarBox).not.toBeNull();
  await expect(targetSession).toBeVisible();

  await main.evaluate((node) => {
    const element = node as HTMLElement;
    element.scrollTop = element.scrollHeight;
  });

  await expect
    .poll(() =>
      main.evaluate((node) => {
        const element = node as HTMLElement;
        return element.scrollTop;
      })
    )
    .toBeGreaterThan(0);

  const afterSidebarBox = await sidebar.boundingBox();
  expect(afterSidebarBox).not.toBeNull();
  expect(Math.abs((afterSidebarBox?.y ?? 0) - (beforeSidebarBox?.y ?? 0))).toBeLessThan(4);
  await expect(targetSession).toBeVisible();
});
```

- [ ] **Step 2: Run the new E2E test and verify it fails for the right reason**

Run:

```bash
RUN_EXTENSION_E2E=1 npx playwright test tests/e2e/manager-workflows.spec.ts --grep "manager keeps the sidebar visible while the tab list scrolls"
```

Expected before implementation:

```text
FAIL  manager keeps the sidebar visible while the tab list scrolls
Expected: > 0
Received: 0
```

That failure proves `.manager-main` is not yet a real scroll container.

### Task 2: Implement the sticky sidebar and independent main-column scrolling

**Files:**
- Modify: `src/ui/shared/app-shell.css`
- Test: `tests/e2e/manager-workflows.spec.ts`

- [ ] **Step 1: Make the app-shell body able to host nested scroll regions**

Update the shared shell rules so the manager page can allocate remaining viewport height to the workbench instead of letting the whole document keep growing.

```css
.app-shell {
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-height: 100vh;
  padding: 24px;
}

.app-shell__body {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 16px;
  min-height: 0;
}
```

- [ ] **Step 2: Turn the manager workbench into a bounded two-column layout on desktop**

Replace the current workbench/sidebar/main rules with the following desktop behavior.

```css
.manager-workbench {
  display: grid;
  grid-template-columns: minmax(240px, 320px) minmax(0, 1fr);
  gap: 18px;
  align-items: stretch;
  flex: 1 1 auto;
  min-height: 0;
}

.manager-sidebar {
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-height: 0;
  max-height: calc(100vh - 48px);
  position: sticky;
  top: 24px;
  align-self: start;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.manager-main {
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-right: 4px;
}
```

This keeps the left target list visible while the right detail panel is the thing that scrolls.

- [ ] **Step 3: Preserve the existing mobile fallback instead of forcing dual scroll panes on small screens**

Extend the mobile media block so narrow screens return to normal document flow.

```css
@media (max-width: 640px) {
  .app-shell__body,
  .manager-workbench,
  .manager-sidebar,
  .manager-main {
    min-height: initial;
  }

  .manager-sidebar {
    position: static;
    top: auto;
    max-height: none;
    overflow: visible;
  }

  .manager-main {
    overflow: visible;
    padding-right: 0;
  }

  .manager-workbench,
  .manager-detail__meta-row,
  .manager-detail__header,
  .manager-tab {
    grid-template-columns: minmax(0, 1fr);
    flex-direction: column;
    align-items: stretch;
  }
}
```

- [ ] **Step 4: Re-run the targeted E2E regression and verify it passes**

Run:

```bash
RUN_EXTENSION_E2E=1 npx playwright test tests/e2e/manager-workflows.spec.ts --grep "manager keeps the sidebar visible while the tab list scrolls"
```

Expected after implementation:

```text
PASS  manager keeps the sidebar visible while the tab list scrolls
```

### Task 3: Run the quality gates for this manager-page change

**Files:**
- Modify: none
- Test: `tests/e2e/manager-workflows.spec.ts`

- [ ] **Step 1: Run the fast local checks first**

Run:

```bash
npm run lint
npm run typecheck
npm run build
```

Expected:

```text
eslint exits with code 0
tsc exits with code 0
vite build completes successfully
```

- [ ] **Step 2: Run the full browser-backed regression gate for manager flows**

Run:

```bash
RUN_EXTENSION_E2E=1 npx playwright test tests/e2e/manager-workflows.spec.ts
```

Expected:

```text
All manager workflow tests pass, including the new sticky-sidebar regression.
```

- [ ] **Step 3: Manually confirm the UX matches the spec**

Use this checklist in a browser session with the built extension loaded:

```text
1. Open manager page with one long session and at least one other active session.
2. Scroll the right detail column to the bottom.
3. Confirm the left session list remains visible in the viewport.
4. Drag a tab from the lower part of the right list onto a different left-side group.
5. Resize below the mobile breakpoint and confirm the layout returns to a single natural column.
```

## Notes

- Do not change `src/ui/manager/App.tsx` unless CSS alone cannot create the scroll behavior.
- Do not alter the drag payload types, session domain logic, or storage schema for this UI-only fix.
- Do not add new permissions, new storage fields, or a second drag-and-drop model.
