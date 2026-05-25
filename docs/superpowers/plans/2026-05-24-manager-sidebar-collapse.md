# Manager Sidebar Collapse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persisted left-sidebar collapse/expand rail to the manager page so the sidebar defaults to expanded, can collapse into a narrow rail, and restores the user's last preference on the next visit.

**Architecture:** Reuse the existing `ExtensionSettings` pipeline for persistence instead of creating a second storage key. Treat `migrateRootState()` as an additive-only change because its upstream blast radius is CRITICAL; keep the UI behavior local to `ManagerApp` and shared manager CSS, with regression coverage in repository, style-contract, and Playwright tests.

**Tech Stack:** TypeScript (`strict`), React 19, existing local repository + `chrome.storage.local`, Vitest, Playwright, GitNexus MCP, shared manager CSS in `src/ui/shared/app-shell.css`

---

## File Map

- Modify `src/types/settings.ts`
  - Add the persisted manager sidebar preference type and field to `ExtensionSettings`.
- Modify `src/storage/local/schema.ts`
  - Extend `defaultSettings` and `migrateRootState()` so legacy root states gain the new field without overwriting existing settings.
- Modify `src/ui/manager/App.tsx`
  - Load, sync, and persist the sidebar preference; add the collapse/expand rail toggle; gate the full tree behind the expanded state.
- Modify `src/ui/shared/app-shell.css`
  - Add the collapsed rail width, toggle styling, and responsive single-column fallback rules.
- Modify `tests/integration/storage/repository.test.ts`
  - Cover default, persisted, and migrated values for the new settings field.
- Modify `tests/unit/ui/app-shell-styles.test.ts`
  - Lock down the collapsed workbench selector and rail toggle CSS contract.
- Modify `tests/e2e/manager-workflows.spec.ts`
  - Seed the new setting and verify collapse, reload persistence, and re-expansion in the unpacked extension.
- Modify `docs/architecture/data-model.md`
  - Document the new `ExtensionSettings` field and default value.
- Create `docs/adr/adr-006-manager-sidebar-preference.md`
  - Record why manager sidebar preference stays inside unified settings.

## Impact Snapshot

- `ManagerApp` (`src/ui/manager/App.tsx`) upstream impact: **LOW**
  - 1 direct caller: `src/ui/manager/main.tsx`
- `migrateRootState` (`src/storage/local/schema.ts`) upstream impact: **CRITICAL**
  - 29 impacted symbols
  - 22 affected execution flows
  - 8 affected modules

Implementation rule: keep the schema change additive, type-safe, and fully covered by focused repository tests before touching UI code.

### Task 1: Persist the manager sidebar preference safely

**Files:**
- Modify: `src/types/settings.ts`
- Modify: `src/storage/local/schema.ts`
- Test: `tests/integration/storage/repository.test.ts`

- [ ] **Step 1: Write the failing repository tests for the new settings field**

Update `tests/integration/storage/repository.test.ts` so the repository contract covers bootstrap defaults, persisted updates, and legacy migration.

```ts
it("should bootstrap an empty root state when storage is empty", async () => {
  const storage = createMemoryStorage();
  const state = await readRootState(storage);

  expect(state.schemaVersion).toBe(1);
  expect(state.sessions).toEqual([]);
  expect(state.settings.restoreBehavior).toBe("remove-group");
  expect(state.settings.managerGridDensityPreference).toBe("enhanced");
  expect(state.settings.managerSidebarPreference).toBe("expanded");
});

it("should append session groups and persist settings changes", async () => {
  const storage = createMemoryStorage();
  const group = createSessionGroup(
    [{ url: "https://example.com", title: "Example", index: 0 }],
    {
      now: new Date(2026, 3, 19, 10, 45)
    }
  );

  await appendSessionGroup(storage, group);
  await updateSettings(storage, {
    defaultClickAction: "open-manager",
    enableContextMenu: false,
    managerGridDensityPreference: "compact",
    managerSidebarPreference: "collapsed"
  });

  const state = await readRootState(storage);

  expect(state.sessions).toHaveLength(1);
  expect(state.settings.defaultClickAction).toBe("open-manager");
  expect(state.settings.enableContextMenu).toBe(false);
  expect(state.settings.managerGridDensityPreference).toBe("compact");
  expect(state.settings.managerSidebarPreference).toBe("collapsed");
});

it("should migrate legacy saved sessions without clearing user data", async () => {
  const storage = createMemoryStorage();

  await storage.set({
    [ROOT_STORAGE_KEY]: {
      schemaVersion: 1,
      settings: {
        restoreBehavior: "keep-group"
      },
      sessions: [
        {
          id: "legacy-session",
          title: "Legacy Session",
          createdAt: "2026-04-19T10:00:00.000Z",
          updatedAt: "2026-04-19T11:00:00.000Z",
          tabs: [
            {
              id: "legacy-tab",
              title: "Legacy Tab",
              url: "https://example.com/legacy"
            }
          ]
        }
      ]
    }
  });

  const state = await readRootState(storage);

  expect(state.settings.restoreBehavior).toBe("keep-group");
  expect(state.settings.enableContextMenu).toBe(true);
  expect(state.settings.managerGridDensityPreference).toBe("enhanced");
  expect(state.settings.managerSidebarPreference).toBe("expanded");
});
```

- [ ] **Step 2: Run the repository integration test to verify it fails**

Run: `npx vitest run tests/integration/storage/repository.test.ts`

Expected before implementation: FAIL with a missing `managerSidebarPreference` type/property error or a failing assertion that the default value is absent.

- [ ] **Step 3: Implement the new settings type, default, and migration**

Update `src/types/settings.ts`:

```ts
export type RestoreBehavior = "remove-group" | "keep-group";
export type DefaultClickAction = "capture-current-window" | "open-manager";
export type ManagerGridDensityPreference = "compact" | "enhanced";
export type ManagerSidebarPreference = "expanded" | "collapsed";

export interface ExtensionSettings {
  restoreBehavior: RestoreBehavior;
  defaultClickAction: DefaultClickAction;
  showCaptureFeedback: boolean;
  enableContextMenu: boolean;
  managerGridDensityPreference: ManagerGridDensityPreference;
  managerSidebarPreference: ManagerSidebarPreference;
}
```

Update `src/storage/local/schema.ts`:

```ts
export const defaultSettings: ExtensionSettings = {
  restoreBehavior: "remove-group",
  defaultClickAction: "capture-current-window",
  showCaptureFeedback: true,
  enableContextMenu: true,
  managerGridDensityPreference: "enhanced",
  managerSidebarPreference: "expanded"
};
```

```ts
const settings: ExtensionSettings = isObject(input.settings)
  ? {
      restoreBehavior:
        input.settings.restoreBehavior === "keep-group" ? "keep-group" : "remove-group",
      defaultClickAction:
        input.settings.defaultClickAction === "open-manager"
          ? "open-manager"
          : "capture-current-window",
      showCaptureFeedback:
        typeof input.settings.showCaptureFeedback === "boolean"
          ? input.settings.showCaptureFeedback
          : true,
      enableContextMenu:
        typeof input.settings.enableContextMenu === "boolean"
          ? input.settings.enableContextMenu
          : true,
      managerGridDensityPreference:
        input.settings.managerGridDensityPreference === "compact" ? "compact" : "enhanced",
      managerSidebarPreference:
        input.settings.managerSidebarPreference === "collapsed" ? "collapsed" : "expanded"
    }
  : { ...defaultSettings };
```

- [ ] **Step 4: Re-run the repository integration test**

Run: `npx vitest run tests/integration/storage/repository.test.ts`

Expected: PASS for all repository storage scenarios, proving the CRITICAL-path schema change stayed additive.

### Task 2: Add regression coverage and implement the collapsible manager rail

**Files:**
- Modify: `src/ui/manager/App.tsx`
- Modify: `src/ui/shared/app-shell.css`
- Modify: `tests/unit/ui/app-shell-styles.test.ts`
- Modify: `tests/e2e/manager-workflows.spec.ts`

- [ ] **Step 1: Write the failing style-contract and Playwright regressions**

Add a new style-contract test to `tests/unit/ui/app-shell-styles.test.ts`:

```ts
it("should let the manager workbench collapse the sidebar into a saved rail", () => {
  const css = readFileSync(resolve(process.cwd(), "src/ui/shared/app-shell.css"), "utf8");
  const managerApp = readFileSync(resolve(process.cwd(), "src/ui/manager/App.tsx"), "utf8");

  expect(managerApp).toContain('data-sidebar-preference={sidebarPreference}');
  expect(css).toMatch(
    /\.manager-workbench\[data-sidebar-preference="collapsed"\]\s*\{[\s\S]*grid-template-columns:\s*84px minmax\(0,\s*1fr\);[\s\S]*\}/
  );
  expect(css).toMatch(
    /\.manager-sidebar__rail-toggle\s*\{[\s\S]*white-space:\s*normal;[\s\S]*text-align:\s*center;[\s\S]*\}/
  );
});
```

Update the `seedManagerState()` settings block in `tests/e2e/manager-workflows.spec.ts`:

```ts
settings: {
  restoreBehavior: "remove-group",
  defaultClickAction: "capture-current-window",
  showCaptureFeedback: true,
  enableContextMenu: true,
  managerGridDensityPreference: "enhanced",
  managerSidebarPreference: "expanded"
},
```

Add a new browser-backed regression to `tests/e2e/manager-workflows.spec.ts`:

```ts
test("manager remembers collapsed sidebar preference and restores the rail toggle", async ({
  context,
  extensionId
}) => {
  const managerPage = await context.newPage();
  await seedManagerState(extensionId, managerPage, [
    createSeededSession("session-1", "Research Bundle", 6),
    createSeededSession("session-2", "Later Reading", 2)
  ]);

  const workbench = managerPage.locator(".manager-workbench");

  await expect(workbench).toHaveAttribute("data-sidebar-preference", "expanded");
  await expect(managerPage.locator("#session-node-session-1")).toBeVisible();

  await managerPage.getByRole("button", { name: "折叠边栏" }).click();
  await expect(workbench).toHaveAttribute("data-sidebar-preference", "collapsed");
  await expect(managerPage.getByRole("button", { name: "展开边栏" })).toBeVisible();
  await expect(managerPage.locator("#session-node-session-1")).toHaveCount(0);

  await managerPage.reload();
  await expect(workbench).toHaveAttribute("data-sidebar-preference", "collapsed");
  await expect(managerPage.getByRole("button", { name: "展开边栏" })).toBeVisible();

  await managerPage.getByRole("button", { name: "展开边栏" }).click();
  await expect(workbench).toHaveAttribute("data-sidebar-preference", "expanded");
  await expect(managerPage.locator("#session-node-session-1")).toBeVisible();
});
```

- [ ] **Step 2: Run the style-contract test and verify it fails**

Run: `npx vitest run tests/unit/ui/app-shell-styles.test.ts`

Expected before implementation: FAIL because `data-sidebar-preference={sidebarPreference}` and the collapsed-rail CSS selectors do not exist yet.

- [ ] **Step 3: Run the new Playwright regression and verify it fails**

Run:

```bash
RUN_EXTENSION_E2E=1 npx playwright test tests/e2e/manager-workflows.spec.ts --grep "manager remembers collapsed sidebar preference and restores the rail toggle"
```

Expected before implementation: FAIL because the manager page does not yet render a `折叠边栏` button or persist a collapsed rail state.

- [ ] **Step 4: Implement the manager sidebar preference state and toggle wiring**

Update the type import and state setup in `src/ui/manager/App.tsx`:

```ts
import type {
  ManagerGridDensityPreference,
  ManagerSidebarPreference
} from "../../types/settings";
```

```ts
const [densityPreference, setDensityPreference] =
  useState<ManagerGridDensityPreference>("enhanced");
const [sidebarPreference, setSidebarPreference] =
  useState<ManagerSidebarPreference>("expanded");
```

Update both settings sync paths so they read the persisted rail state:

```ts
setDensityPreference(settings.managerGridDensityPreference);
setSidebarPreference(settings.managerSidebarPreference);
```

Add a new persisted toggle handler next to `handleDensityPreferenceChange()`:

```ts
async function handleSidebarPreferenceChange(nextPreference: ManagerSidebarPreference) {
  if (nextPreference === sidebarPreference) {
    return;
  }

  const previousPreference = sidebarPreference;
  setShowMoreActions(false);
  closeSessionMenus();
  setSidebarPreference(nextPreference);

  try {
    await saveSettings({ managerSidebarPreference: nextPreference });
    setStatus(nextPreference === "collapsed" ? "已折叠左侧边栏。" : "已展开左侧边栏。");
  } catch (nextError: unknown) {
    setSidebarPreference(previousPreference);
    setStatus(nextError instanceof Error ? nextError.message : "保存边栏偏好失败。");
  }
}
```

Change the workbench shell so CSS can key off the persisted preference and the sidebar can collapse into a rail:

```tsx
<div className="manager-workbench" data-sidebar-preference={sidebarPreference}>
  <aside className="manager-sidebar card">
    <div className="manager-sidebar__toolbar">
      <button
        aria-expanded={sidebarPreference === "expanded"}
        aria-label={sidebarPreference === "expanded" ? "折叠边栏" : "展开边栏"}
        className="button button--quiet manager-sidebar__rail-toggle"
        onClick={() =>
          void handleSidebarPreferenceChange(
            sidebarPreference === "expanded" ? "collapsed" : "expanded"
          )
        }
        type="button"
      >
        {sidebarPreference === "expanded" ? "折叠边栏" : "展开边栏"}
      </button>
    </div>
  </aside>

  <section className="manager-main" ref={managerMainRef}>
```

Then wrap the two existing `.manager-sidebar__section` blocks directly under the toolbar with this exact opening and closing fragment:

```tsx
    {sidebarPreference === "expanded" ? (
      <>
```

```tsx
      </>
    ) : null}
```

- [ ] **Step 5: Implement the collapsed rail styles and responsive fallback**

Add the rail toolbar and collapsed workbench rules to `src/ui/shared/app-shell.css`:

```css
.manager-sidebar__toolbar {
  display: flex;
  justify-content: flex-end;
}

.manager-sidebar__rail-toggle {
  min-height: 32px;
  white-space: normal;
  text-align: center;
}

.manager-workbench[data-sidebar-preference="collapsed"] {
  grid-template-columns: 84px minmax(0, 1fr);
}

.manager-workbench[data-sidebar-preference="collapsed"] .manager-sidebar {
  gap: 0;
  align-items: stretch;
}

.manager-workbench[data-sidebar-preference="collapsed"] .manager-sidebar.card {
  padding: 14px 8px;
}

.manager-workbench[data-sidebar-preference="collapsed"] .manager-sidebar__toolbar {
  flex: 1 1 auto;
  align-items: stretch;
  justify-content: center;
}

.manager-workbench[data-sidebar-preference="collapsed"] .manager-sidebar__rail-toggle {
  height: 100%;
  min-height: 96px;
  padding: 12px 6px;
}
```

Extend the existing mobile fallback block so the collapsed preference still exposes a usable expand button in single-column layout:

```css
  .manager-workbench[data-sidebar-preference="collapsed"] {
    grid-template-columns: minmax(0, 1fr);
  }

  .manager-workbench[data-sidebar-preference="collapsed"] .manager-sidebar.card {
    padding: 14px 12px;
  }

  .manager-workbench[data-sidebar-preference="collapsed"] .manager-sidebar__rail-toggle {
    height: auto;
    min-height: 0;
    padding: 10px 12px;
  }
```

- [ ] **Step 6: Re-run the focused regression coverage**

Run: `npx vitest run tests/integration/storage/repository.test.ts tests/unit/ui/app-shell-styles.test.ts`

Expected: PASS for the repository and shared-style regression coverage.

Run:

```bash
RUN_EXTENSION_E2E=1 npx playwright test tests/e2e/manager-workflows.spec.ts --grep "manager remembers collapsed sidebar preference and restores the rail toggle"
```

Expected: PASS, proving collapse, reload persistence, and re-expansion all work in the unpacked extension.

### Task 3: Record the decision, update the data model, and run merge-gate verification

**Files:**
- Create: `docs/adr/adr-006-manager-sidebar-preference.md`
- Modify: `docs/architecture/data-model.md`

- [ ] **Step 1: Add the ADR for the persisted manager sidebar preference**

Create `docs/adr/adr-006-manager-sidebar-preference.md`:

```md
# ADR-006 Manager Sidebar Preference

- Status: Accepted
- Date: 2026-05-24

## Context

Manager 页左侧分组边栏需要新增整栏折叠/展开能力，并且用户明确要求该状态在刷新和重新打开页面后仍然保持。

这个需求可以通过单独 local storage key 或复用现有 `ExtensionSettings` 完成。由于 manager 已经有 `managerGridDensityPreference` 这类页面级持久化偏好，继续复用统一 settings 模型可以避免第二套设置读写路径和迁移入口。

同时，边栏折叠状态不属于纯运行时布局细节，而是稳定的用户偏好，因此需要纳入 schema 管理。

## Decision

- 在 `ExtensionSettings` 中新增 `managerSidebarPreference` 字段。
- 字段取值限定为 `expanded | collapsed`。
- 默认值为 `expanded`。
- 旧数据通过 `migrateRootState()` 自动补默认值，不重置其他设置。
- Manager 页运行时读取该字段，并在用户切换折叠状态后写回。

## Consequences

- Manager 页的边栏偏好能在刷新、重开和多页面同步后保持一致。
- `migrateRootState()` 需要增加一个 additive migration 分支，并由 repository 测试保护。
- Manager UI 需要同时处理“当前是否展开”和“如何把状态写回 settings”这两个关注点。
```

- [ ] **Step 2: Update the data model documentation**

Update the `ExtensionSettings` block in `docs/architecture/data-model.md`:

```ts
interface ExtensionSettings {
  restoreBehavior: "remove-group" | "keep-group";
  defaultClickAction: "capture-current-window" | "open-manager";
  showCaptureFeedback: boolean;
  enableContextMenu: boolean;
  managerGridDensityPreference: "compact" | "enhanced";
  managerSidebarPreference: "expanded" | "collapsed";
}
```

Add the default value:

```md
- `managerSidebarPreference`: `expanded`
```

- [ ] **Step 3: Run lint**

Run: `npm run lint`

Expected: PASS with no new ESLint errors.

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`

Expected: PASS with no TypeScript errors.

- [ ] **Step 5: Run the full unit/integration test suite**

Run: `npm run test`

Expected: PASS for the full Vitest suite, including repository and shared-style regressions.

- [ ] **Step 6: Run the production build**

Run: `npm run build`

Expected: PASS and emit an updated `dist/` bundle with no build-time errors.

- [ ] **Step 7: Run the browser-backed E2E gate**

Run: `RUN_EXTENSION_E2E=1 npm run test:e2e`

Expected: PASS for the full manager and extension workflow suite.

- [ ] **Step 8: Run GitNexus change detection before committing**

GitNexus MCP:

```json
detect_changes({ "repo": "onetab", "scope": "all" })
```

Expected: affected symbols should be limited to the settings schema/read path, `ManagerApp`, shared manager CSS, targeted tests, and the new ADR/data-model docs.

- [ ] **Step 9: Commit the complete feature**

```bash
git add src/types/settings.ts src/storage/local/schema.ts src/ui/manager/App.tsx src/ui/shared/app-shell.css tests/integration/storage/repository.test.ts tests/unit/ui/app-shell-styles.test.ts tests/e2e/manager-workflows.spec.ts docs/architecture/data-model.md docs/adr/adr-006-manager-sidebar-preference.md
git commit -m "feat: add collapsible manager sidebar"
```
