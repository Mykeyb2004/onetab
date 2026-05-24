# Manager Grid Density View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the manager detail pane's linear tab list with a single responsive card grid that supports persisted `简洁 / 增强` density modes, automatic compact fallback on narrow widths, and hover/focus icon actions without breaking existing restore and drag workflows.

**Architecture:** Keep persistence concerns in the existing settings/storage stack, move density resolution into a pure helper, and extract the new grid renderer into a focused manager component so `src/ui/manager/App.tsx` remains the orchestration layer. Preserve the existing session ordering and drag payloads; only the presentation, density preference, and card interaction model change.

**Tech Stack:** TypeScript (`strict`), React 19, existing local repository + `chrome.storage.local`, Vitest, Playwright, shared manager CSS in `src/ui/shared/app-shell.css`

---

## File Map

- Modify `src/types/settings.ts`
  - Add the persisted manager grid density preference type and field to `ExtensionSettings`.
- Modify `src/storage/local/schema.ts`
  - Extend `defaultSettings` and `migrateRootState()` so legacy root states gain the new setting without clobbering existing values.
- Modify `src/features/settings/load-settings.ts`
  - Export a focused `loadExtensionSettings()` helper so `ManagerApp` can read settings without importing settings-page-only persistence logic.
- Create `src/ui/manager/grid-density.ts`
  - Hold the pure runtime density resolver and grid width constants.
- Create `src/ui/manager/ManagerTabGrid.tsx`
  - Render compact/enhanced tab cards, icon actions, touch-safe action reveal state, and grid-specific drag/drop surfaces.
- Modify `src/ui/manager/App.tsx`
  - Load and persist the density preference, observe available width, resolve the effective density, render the new toggle, and swap the list for `ManagerTabGrid`.
- Modify `src/ui/shared/app-shell.css`
  - Add responsive grid/card/icon styles and preserve the sticky sidebar behavior.
- Modify `tests/integration/storage/repository.test.ts`
  - Cover defaults, persistence, and migration for the new setting.
- Create `tests/unit/ui/manager-grid-density.test.ts`
  - Lock down the runtime density resolver.
- Modify `tests/unit/ui/app-shell-styles.test.ts`
  - Lock down the new grid/card CSS selectors and interaction affordances.
- Modify `tests/e2e/manager-workflows.spec.ts`
  - Cover density persistence, auto fallback, and icon-action workflows in the unpacked extension.
- Modify `docs/architecture/data-model.md`
  - Document the new `ExtensionSettings` field and default.
- Modify `docs/adr/adr-005-manager-grid-density-preference.md`
  - Mark the ADR accepted once implementation lands.

## Task 1: Persist the manager grid density preference safely

**Files:**
- Modify: `src/types/settings.ts`
- Modify: `src/storage/local/schema.ts`
- Modify: `src/features/settings/load-settings.ts`
- Test: `tests/integration/storage/repository.test.ts`

- [ ] **Step 1: Write the failing integration tests for the new settings field**

Add assertions to `tests/integration/storage/repository.test.ts` so the repository contract covers the new preference in all three paths: bootstrap, persistence, and migration.

```ts
it("should bootstrap an empty root state when storage is empty", async () => {
  const storage = createMemoryStorage();
  const state = await readRootState(storage);

  expect(state.schemaVersion).toBe(1);
  expect(state.sessions).toEqual([]);
  expect(state.settings.restoreBehavior).toBe("remove-group");
  expect(state.settings.managerGridDensityPreference).toBe("enhanced");
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
    managerGridDensityPreference: "compact"
  });

  const state = await readRootState(storage);

  expect(state.sessions).toHaveLength(1);
  expect(state.settings.defaultClickAction).toBe("open-manager");
  expect(state.settings.enableContextMenu).toBe(false);
  expect(state.settings.managerGridDensityPreference).toBe("compact");
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
});
```

- [ ] **Step 2: Run the repository integration test to verify it fails**

Run: `npx vitest run tests/integration/storage/repository.test.ts`

Expected: FAIL with `Property 'managerGridDensityPreference' does not exist on type 'ExtensionSettings'` or an equivalent missing-field assertion.

- [ ] **Step 3: Implement the new settings type, defaults, migration, and read helper**

Update `src/types/settings.ts`:

```ts
export type RestoreBehavior = "remove-group" | "keep-group";
export type DefaultClickAction = "capture-current-window" | "open-manager";
export type ManagerGridDensityPreference = "compact" | "enhanced";

export interface ExtensionSettings {
  restoreBehavior: RestoreBehavior;
  defaultClickAction: DefaultClickAction;
  showCaptureFeedback: boolean;
  enableContextMenu: boolean;
  managerGridDensityPreference: ManagerGridDensityPreference;
}
```

Update `src/storage/local/schema.ts`:

```ts
export const defaultSettings: ExtensionSettings = {
  restoreBehavior: "remove-group",
  defaultClickAction: "capture-current-window",
  showCaptureFeedback: true,
  enableContextMenu: true,
  managerGridDensityPreference: "enhanced"
};

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
        input.settings.managerGridDensityPreference === "compact" ? "compact" : "enhanced"
    }
  : { ...defaultSettings };
```

Update `src/features/settings/load-settings.ts` so manager code can reuse a focused helper:

```ts
export async function loadExtensionSettings(): Promise<ExtensionSettings> {
  const state = await readRootState(chromeLocalStorage);
  return state.settings;
}

export async function loadSettingsPageState(): Promise<SettingsPageState> {
  const persistence = await loadPersistenceDirectoryState();
  let settings: ExtensionSettings | null = null;
  let settingsError: string | null = null;

  try {
    settings = await loadExtensionSettings();
  } catch (error: unknown) {
    settingsError =
      error instanceof Error ? error.message : "Failed to load settings from the active data store.";
  }

  return {
    settings,
    settingsError,
    persistence
  };
}
```

- [ ] **Step 4: Run the repository integration test again**

Run: `npx vitest run tests/integration/storage/repository.test.ts`

Expected: PASS for all repository storage scenarios.

- [ ] **Step 5: Commit the schema-safe settings change**

```bash
git add src/types/settings.ts src/storage/local/schema.ts src/features/settings/load-settings.ts tests/integration/storage/repository.test.ts
git commit -m "feat: persist manager grid density preference"
```

## Task 2: Add a pure runtime density resolver

**Files:**
- Create: `src/ui/manager/grid-density.ts`
- Test: `tests/unit/ui/manager-grid-density.test.ts`

- [ ] **Step 1: Write the failing unit tests for effective density resolution**

Create `tests/unit/ui/manager-grid-density.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  COMPACT_CARD_MIN_WIDTH,
  ENHANCED_CARD_MIN_WIDTH,
  resolveManagerGridDensity
} from "../../../src/ui/manager/grid-density";

describe("resolveManagerGridDensity", () => {
  it("should keep compact preference regardless of available width", () => {
    expect(
      resolveManagerGridDensity({
        preference: "compact",
        containerWidth: ENHANCED_CARD_MIN_WIDTH * 3
      })
    ).toEqual({
      effectiveDensity: "compact",
      isAutoDowngraded: false
    });
  });

  it("should keep enhanced preference when the container is wide enough", () => {
    expect(
      resolveManagerGridDensity({
        preference: "enhanced",
        containerWidth: ENHANCED_CARD_MIN_WIDTH * 2 + 12
      })
    ).toEqual({
      effectiveDensity: "enhanced",
      isAutoDowngraded: false
    });
  });

  it("should auto-downgrade enhanced preference when the container is too narrow", () => {
    expect(
      resolveManagerGridDensity({
        preference: "enhanced",
        containerWidth: ENHANCED_CARD_MIN_WIDTH - 1
      })
    ).toEqual({
      effectiveDensity: "compact",
      isAutoDowngraded: true
    });
  });

  it("should expose smaller card widths for compact mode", () => {
    expect(COMPACT_CARD_MIN_WIDTH).toBeLessThan(ENHANCED_CARD_MIN_WIDTH);
  });
});
```

- [ ] **Step 2: Run the new unit test to verify it fails**

Run: `npx vitest run tests/unit/ui/manager-grid-density.test.ts`

Expected: FAIL because `src/ui/manager/grid-density.ts` does not exist yet.

- [ ] **Step 3: Implement the pure helper**

Create `src/ui/manager/grid-density.ts`:

```ts
import type { ManagerGridDensityPreference } from "../../types/settings";

export type EffectiveManagerGridDensity = "compact" | "enhanced";

export const COMPACT_CARD_MIN_WIDTH = 220;
export const ENHANCED_CARD_MIN_WIDTH = 280;
export const ENHANCED_GRID_MIN_WIDTH = ENHANCED_CARD_MIN_WIDTH * 2 + 12;

interface ResolveManagerGridDensityOptions {
  preference: ManagerGridDensityPreference;
  containerWidth: number;
}

export function resolveManagerGridDensity({
  preference,
  containerWidth
}: ResolveManagerGridDensityOptions): {
  effectiveDensity: EffectiveManagerGridDensity;
  isAutoDowngraded: boolean;
} {
  const isAutoDowngraded =
    preference === "enhanced" && containerWidth > 0 && containerWidth < ENHANCED_GRID_MIN_WIDTH;

  return {
    effectiveDensity: isAutoDowngraded ? "compact" : preference,
    isAutoDowngraded
  };
}

export function getGridCardMinWidth(density: EffectiveManagerGridDensity): number {
  return density === "enhanced" ? ENHANCED_CARD_MIN_WIDTH : COMPACT_CARD_MIN_WIDTH;
}
```

- [ ] **Step 4: Run the unit test again**

Run: `npx vitest run tests/unit/ui/manager-grid-density.test.ts`

Expected: PASS with all four resolver assertions green.

- [ ] **Step 5: Commit the pure helper**

```bash
git add src/ui/manager/grid-density.ts tests/unit/ui/manager-grid-density.test.ts
git commit -m "test: lock manager grid density resolution"
```

## Task 3: Freeze the extension-level behavior with Playwright before the UI refactor

**Files:**
- Modify: `tests/e2e/manager-workflows.spec.ts`

- [ ] **Step 1: Add failing Playwright coverage for density persistence, auto fallback, and icon actions**

Extend `tests/e2e/manager-workflows.spec.ts` with the new setting in the seed data and three new tests.

```ts
async function seedManagerState(
  extensionId: string,
  managerPage: import("@playwright/test").Page,
  sessions = [createSeededSession("session-1", "Research Bundle", 2)]
) {
  await managerPage.goto(`chrome-extension://${extensionId}/manager.html`);
  await managerPage.evaluate(
    async ({
      storageKey,
      nextSessions
    }: {
      storageKey: string;
      nextSessions: typeof sessions;
    }) => {
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

  await managerPage.reload();
}

async function expectGridDensity(
  page: import("@playwright/test").Page,
  density: "compact" | "enhanced"
) {
  await expect(page.locator(".manager-tab-grid")).toHaveAttribute("data-density", density);
}

test("manager persists the selected grid density after reload", async ({
  context,
  extensionId
}) => {
  const managerPage = await context.newPage();
  await seedManagerState(extensionId, managerPage, [createSeededSession("session-1", "Long Session", 6)]);

  await managerPage.getByRole("button", { name: "简洁" }).click();
  await expectGridDensity(managerPage, "compact");

  await managerPage.reload();
  await expectGridDensity(managerPage, "compact");
});

test("manager auto-downgrades enhanced density when the pane gets too narrow", async ({
  context,
  extensionId
}) => {
  const managerPage = await context.newPage();
  await managerPage.setViewportSize({ width: 1440, height: 900 });
  await seedManagerState(extensionId, managerPage, [createSeededSession("session-1", "Long Session", 8)]);

  await managerPage.getByRole("button", { name: "增强" }).click();
  await expectGridDensity(managerPage, "enhanced");

  await managerPage.setViewportSize({ width: 820, height: 900 });
  await expect(managerPage.locator(".manager-tab-grid")).toHaveAttribute("data-auto-downgraded", "true");
  await expectGridDensity(managerPage, "compact");

  await managerPage.setViewportSize({ width: 1440, height: 900 });
  await expect(managerPage.locator(".manager-tab-grid")).toHaveAttribute("data-auto-downgraded", "false");
  await expectGridDensity(managerPage, "enhanced");
});

test("manager exposes icon actions on focused cards without triggering drag", async ({
  context,
  extensionId
}) => {
  const managerPage = await context.newPage();
  await seedManagerState(extensionId, managerPage);

  const firstCard = managerPage.locator(".manager-tab-card").first();
  await firstCard.focus();

  await expect(
    managerPage.getByRole("button", { name: "还原并移除 “React Compiler”" })
  ).toBeVisible();
  await managerPage
    .getByRole("button", { name: "还原并移除 “React Compiler”" })
    .click();

  await expect(managerPage.getByText(/Restored 1 tab/)).toBeVisible();
});
```

- [ ] **Step 2: Run the new manager E2E coverage and confirm it fails**

Run: `RUN_EXTENSION_E2E=1 npx playwright test tests/e2e/manager-workflows.spec.ts`

Expected: FAIL because the manager still renders list rows, there is no `简洁 / 增强` toggle, and `.manager-tab-grid` / `.manager-tab-card` selectors do not exist yet.

- [ ] **Step 3: Keep the failing tests committed in the branch as the UI contract**

```bash
git add tests/e2e/manager-workflows.spec.ts
git commit -m "test: add manager grid density e2e coverage"
```

## Task 4: Replace the list renderer with a responsive card grid

**Files:**
- Create: `src/ui/manager/ManagerTabGrid.tsx`
- Modify: `src/ui/manager/App.tsx`
- Modify: `src/ui/shared/app-shell.css`
- Test: `tests/unit/ui/app-shell-styles.test.ts`

- [ ] **Step 1: Write the failing style assertions for the new grid/card selectors**

Add to `tests/unit/ui/app-shell-styles.test.ts`:

```ts
it("should render manager tabs as a responsive auto-fill grid", () => {
  const css = readFileSync(resolve(process.cwd(), "src/ui/shared/app-shell.css"), "utf8");

  expect(css).toMatch(
    /\.manager-tab-grid\s*\{[\s\S]*display:\s*grid;[\s\S]*grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(var\(--manager-grid-min-card-width\),\s*1fr\)\);[\s\S]*\}/
  );
});

it("should keep card actions visually hidden until hover, focus, or explicit reveal", () => {
  const css = readFileSync(resolve(process.cwd(), "src/ui/shared/app-shell.css"), "utf8");

  expect(css).toMatch(
    /\.manager-tab-card__actions\s*\{[\s\S]*opacity:\s*0;[\s\S]*pointer-events:\s*none;[\s\S]*\}/
  );
  expect(css).toMatch(
    /\.manager-tab-card:is\(:hover,\s*:focus-within,\s*\[data-actions-visible="true"\]\)\s*\.manager-tab-card__actions\s*\{[\s\S]*opacity:\s*1;[\s\S]*pointer-events:\s*auto;[\s\S]*\}/
  );
});
```

- [ ] **Step 2: Run the style test to verify it fails**

Run: `npx vitest run tests/unit/ui/app-shell-styles.test.ts`

Expected: FAIL because the new grid and card selectors are not in `src/ui/shared/app-shell.css`.

- [ ] **Step 3: Implement the grid component, manager wiring, and CSS**

Create `src/ui/manager/ManagerTabGrid.tsx`:

```tsx
import { useMemo, useState } from "react";
import type { CSSProperties, FocusEvent, PointerEvent } from "react";
import type { SavedTab } from "../../types/session";
import type { EffectiveManagerGridDensity } from "./grid-density";
import { getGridCardMinWidth } from "./grid-density";

interface ManagerTabGridProps {
  density: EffectiveManagerGridDensity;
  isAutoDowngraded: boolean;
  isInteractive: boolean;
  sessionId: string;
  tabs: SavedTab[];
  busyKey: string | null;
  draggedTabId: string | null;
  dragOverTabId: string | null;
  isTabDropAtEnd: boolean;
  onOpenTab: (sessionId: string, tabId: string) => Promise<void>;
  onRestoreTab: (sessionId: string, tabId: string) => Promise<void>;
  onDeleteTab: (sessionId: string, tabId: string) => Promise<void>;
  onClearDragState: () => void;
  onTabDragStart: (event: React.DragEvent<HTMLDivElement>, sessionId: string, tabId: string) => void;
  onTabDragOver: (event: React.DragEvent<HTMLDivElement>, sessionId: string, tabId: string | null) => void;
  onTabDrop: (event: React.DragEvent<HTMLDivElement>, sessionId: string, tabId: string | null) => Promise<void>;
}

function buildTabMeta(savedTab: SavedTab): string {
  if (savedTab.lastOpenedAt) {
    return `最近打开 ${new Date(savedTab.lastOpenedAt).toLocaleDateString("zh-CN")}`;
  }
  return `保存于 ${new Date(savedTab.createdAt).toLocaleDateString("zh-CN")}`;
}

export function ManagerTabGrid({
  density,
  isAutoDowngraded,
  isInteractive,
  sessionId,
  tabs,
  busyKey,
  draggedTabId,
  dragOverTabId,
  isTabDropAtEnd,
  onOpenTab,
  onRestoreTab,
  onDeleteTab,
  onClearDragState,
  onTabDragStart,
  onTabDragOver,
  onTabDrop
}: ManagerTabGridProps) {
  const [revealedActionTabId, setRevealedActionTabId] = useState<string | null>(null);

  const gridStyle = useMemo(
    () =>
      ({
        "--manager-grid-min-card-width": `${getGridCardMinWidth(density)}px`
      }) as CSSProperties,
    [density]
  );

  function handleCardBlur(event: FocusEvent<HTMLElement>, tabId: string) {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return;
    }

    setRevealedActionTabId((current) => (current === tabId ? null : current));
  }

  function handleCardPointerDown(event: PointerEvent<HTMLElement>, tabId: string) {
    if (event.pointerType === "mouse") {
      return;
    }

    if (event.target === event.currentTarget) {
      setRevealedActionTabId(tabId);
    }
  }

  return (
    <div
      className="manager-tab-grid"
      data-density={density}
      data-auto-downgraded={isAutoDowngraded ? "true" : "false"}
      style={gridStyle}
    >
      {tabs.map((savedTab) => {
        const actionsVisible = revealedActionTabId === savedTab.id;

        return (
          <article
            className={`manager-tab-card ${draggedTabId === savedTab.id ? "manager-tab-card--dragging" : ""} ${dragOverTabId === savedTab.id ? "manager-tab-card--drop-target" : ""}`}
            data-actions-visible={actionsVisible ? "true" : "false"}
            key={savedTab.id}
            onBlur={(event) => handleCardBlur(event, savedTab.id)}
            onFocus={() => setRevealedActionTabId(savedTab.id)}
            onPointerDown={(event) => handleCardPointerDown(event, savedTab.id)}
            tabIndex={0}
          >
            {isInteractive ? (
              <div className="manager-tab-card__actions">
                <button
                  aria-label={`打开 “${savedTab.title}”`}
                  className="manager-tab-card__icon-button"
                  disabled={busyKey !== null}
                  onClick={() => void onOpenTab(sessionId, savedTab.id)}
                  type="button"
                >
                  ↗
                </button>
                <button
                  aria-label={`还原并移除 “${savedTab.title}”`}
                  className="manager-tab-card__icon-button"
                  disabled={busyKey !== null}
                  onClick={() => void onRestoreTab(sessionId, savedTab.id)}
                  type="button"
                >
                  ⤴
                </button>
                <button
                  aria-label={`删除 “${savedTab.title}”`}
                  className="manager-tab-card__icon-button"
                  disabled={busyKey !== null}
                  onClick={() => void onDeleteTab(sessionId, savedTab.id)}
                  type="button"
                >
                  ×
                </button>
              </div>
            ) : null}

            <div
              className="manager-tab-card__body"
              draggable={isInteractive}
              onDragEnd={onClearDragState}
              onDragOver={(event) => onTabDragOver(event, sessionId, savedTab.id)}
              onDragStart={(event) => onTabDragStart(event, sessionId, savedTab.id)}
              onDrop={(event) => void onTabDrop(event, sessionId, savedTab.id)}
            >
              <div className="manager-tab-card__icon">
                {savedTab.favIconUrl ? <img alt="" src={savedTab.favIconUrl} /> : <span>{savedTab.title.slice(0, 1).toUpperCase()}</span>}
              </div>
              <div className="manager-tab-card__copy">
                <strong>{savedTab.title}</strong>
                <span>{new URL(savedTab.url).hostname}</span>
                {density === "enhanced" ? (
                  <small className="manager-tab-card__meta">{buildTabMeta(savedTab)}</small>
                ) : null}
              </div>
            </div>
          </article>
        );
      })}

      {isInteractive ? (
        <div
          aria-label="拖拽记录到当前分组末尾"
          className={`manager-tab-grid__dropzone ${isTabDropAtEnd ? "manager-tab-grid__dropzone--active" : ""}`}
          onDragOver={(event) => onTabDragOver(event, sessionId, null)}
          onDrop={(event) => void onTabDrop(event, sessionId, null)}
        >
          {tabs.length === 0 ? "拖入记录到此分组" : "拖到这里放到末尾"}
        </div>
      ) : null}
    </div>
  );
}
```

Update the manager load/save logic in `src/ui/manager/App.tsx`:

```tsx
import { loadExtensionSettings } from "../../features/settings/load-settings";
import { saveSettings } from "../../features/settings/save-settings";
import type { ManagerGridDensityPreference } from "../../types/settings";
import { ManagerTabGrid } from "./ManagerTabGrid";
import { resolveManagerGridDensity } from "./grid-density";

const [densityPreference, setDensityPreference] =
  useState<ManagerGridDensityPreference>("enhanced");
const [managerMainWidth, setManagerMainWidth] = useState(0);
const managerMainRef = useRef<HTMLElement | null>(null);

const densityState = useMemo(
  () =>
    resolveManagerGridDensity({
      preference: densityPreference,
      containerWidth: managerMainWidth
    }),
  [densityPreference, managerMainWidth]
);

useEffect(() => {
  const element = managerMainRef.current;

  if (!element) {
    return;
  }

  const observer = new ResizeObserver(([entry]) => {
    setManagerMainWidth(entry.contentRect.width);
  });

  observer.observe(element);
  setManagerMainWidth(element.getBoundingClientRect().width);

  return () => observer.disconnect();
}, [selectedSession?.id]);

useEffect(() => {
  let alive = true;

  Promise.all([listSessionGroups(), loadExtensionSettings()])
    .then(([collections, settings]) => {
      if (!alive) {
        return;
      }

      const nextSelection = buildSelection(collections, "active", null);
      setSessionCollections(collections);
      setSelectedBucket(nextSelection.bucket);
      setSelectedSessionId(nextSelection.sessionId);
      setDensityPreference(settings.managerGridDensityPreference);
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

async function handleDensityPreferenceChange(nextPreference: ManagerGridDensityPreference) {
  setDensityPreference(nextPreference);

  try {
    await saveSettings({ managerGridDensityPreference: nextPreference });
    setStatus(`已切换到${nextPreference === "compact" ? "简洁" : "增强"}卡片密度。`);
  } catch (nextError: unknown) {
    setStatus(nextError instanceof Error ? nextError.message : "保存卡片密度偏好失败。");
  }
}
```

Replace the detail-pane tab list in `src/ui/manager/App.tsx`:

```tsx
<div className="inline-actions">
  {selectedBucket === "active" ? (
    <div aria-label="标签信息密度" className="manager-density-toggle" role="group">
      <button
        className={`button button--quiet button--small ${densityPreference === "compact" ? "button--active" : ""}`}
        onClick={() => void handleDensityPreferenceChange("compact")}
        type="button"
      >
        简洁
      </button>
      <button
        className={`button button--quiet button--small ${densityPreference === "enhanced" ? "button--active" : ""}`}
        onClick={() => void handleDensityPreferenceChange("enhanced")}
        type="button"
      >
        增强
      </button>
    </div>
  ) : null}
  {/* existing 全部还原 / 更多操作 buttons remain here */}
</div>

{selectedBucket === "active" ? (
  <p className="muted manager-tabs__hint">
    拖拽标签可调整组内顺序，拖到左侧分组可跨组移动。
    {densityState.isAutoDowngraded ? " 当前宽度不足，已临时切换为简洁密度。" : ""}
  </p>
) : null}

<ManagerTabGrid
  busyKey={busyKey}
  density={densityState.effectiveDensity}
  dragOverTabId={dragOverTabId}
  draggedTabId={draggedTabId}
  isAutoDowngraded={densityState.isAutoDowngraded}
  isInteractive={selectedBucket === "active"}
  isTabDropAtEnd={isTabDropAtEnd}
  onClearDragState={clearDragState}
  onDeleteTab={handleDeleteTab}
  onOpenTab={handleOpenTab}
  onRestoreTab={handleRestoreTab}
  onTabDragOver={handleTabDragOver}
  onTabDragStart={handleTabDragStart}
  onTabDrop={handleTabDrop}
  sessionId={selectedSession.id}
  tabs={selectedSession.tabs}
/>
```

Add the new card/grid rules to `src/ui/shared/app-shell.css`:

```css
.manager-tab-grid {
  --manager-grid-min-card-width: 220px;
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(auto-fill, minmax(var(--manager-grid-min-card-width), 1fr));
}

.manager-tab-card {
  position: relative;
  min-height: 168px;
  border-radius: 18px;
  background: rgba(24, 33, 38, 0.04);
  box-shadow: inset 0 0 0 1px rgba(24, 33, 38, 0.05);
}

.manager-tab-card__actions {
  position: absolute;
  top: 10px;
  right: 10px;
  display: flex;
  gap: 6px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 160ms ease;
}

.manager-tab-card:is(:hover, :focus-within, [data-actions-visible="true"]) .manager-tab-card__actions {
  opacity: 1;
  pointer-events: auto;
}

.manager-tab-card__icon-button {
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 10px;
  background: rgba(24, 33, 38, 0.08);
  color: #182126;
}

.manager-tab-card__body {
  display: grid;
  gap: 10px;
  min-height: 100%;
  padding: 16px;
}

.manager-tab-card__meta {
  color: #5f6a72;
  font-size: 12px;
}

.manager-density-toggle {
  display: inline-flex;
  gap: 8px;
}

.manager-tab-grid__dropzone {
  min-height: 88px;
  border: 1px dashed rgba(24, 33, 38, 0.2);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #5f6a72;
}
```

- [ ] **Step 4: Run the targeted unit and E2E suites**

Run:

```bash
npx vitest run tests/integration/storage/repository.test.ts tests/unit/ui/manager-grid-density.test.ts tests/unit/ui/app-shell-styles.test.ts
RUN_EXTENSION_E2E=1 npx playwright test tests/e2e/manager-workflows.spec.ts
```

Expected: PASS for repository, density, style, and manager workflow coverage.

- [ ] **Step 5: Commit the UI refactor**

```bash
git add src/ui/manager/ManagerTabGrid.tsx src/ui/manager/App.tsx src/ui/shared/app-shell.css tests/unit/ui/app-shell-styles.test.ts
git commit -m "feat: add manager grid density view"
```

## Task 5: Update architecture docs and run the full quality gates

**Files:**
- Modify: `docs/architecture/data-model.md`
- Modify: `docs/adr/adr-005-manager-grid-density-preference.md`

- [ ] **Step 1: Update the data model document and mark the ADR accepted**

Update the `ExtensionSettings` section in `docs/architecture/data-model.md`:

```md
interface ExtensionSettings {
  restoreBehavior: "remove-group" | "keep-group";
  defaultClickAction: "capture-current-window" | "open-manager";
  showCaptureFeedback: boolean;
  enableContextMenu: boolean;
  managerGridDensityPreference: "compact" | "enhanced";
}
```

Add the default:

```md
- `managerGridDensityPreference`: `enhanced`
```

Update `docs/adr/adr-005-manager-grid-density-preference.md`:

```md
- Status: Accepted
```

- [ ] **Step 2: Run the repo quality gates in the order required by `AGENTS.md`**

Run:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
RUN_EXTENSION_E2E=1 npm run test:e2e
```

Expected:

- `lint`: exits `0`
- `typecheck`: exits `0`
- `test`: all Vitest unit/integration suites pass
- `build`: Vite build succeeds
- `test:e2e`: Playwright suite passes with the unpacked extension

- [ ] **Step 3: Commit the documentation sync and verification state**

```bash
git add docs/architecture/data-model.md docs/adr/adr-005-manager-grid-density-preference.md
git commit -m "docs: sync manager grid density architecture"
```

## Self-Review Checklist

- Spec coverage:
  - Persisted density preference: Task 1
  - Runtime auto fallback: Task 2 + Task 4
  - Single responsive grid: Task 4
  - Hover/focus/touch-safe icon actions: Task 4 + Task 3
  - Preserved drag/reorder behavior: Task 4 + Task 3
  - Docs and ADR updates: Task 5
- Placeholder scan:
  - No `TODO`, `TBD`, or “similar to previous task” placeholders remain.
- Type consistency:
  - The plan uses `managerGridDensityPreference`, `compact`, and `enhanced` consistently across settings, runtime logic, tests, and docs.
