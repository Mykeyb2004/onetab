# Manager Card Tint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add stable, very-light card tinting to the manager tab grid by mapping each saved tab to a small set of color families, while keeping the existing text colors unchanged and handling missing favicons deterministically.

**Architecture:** Keep the color-family decision in a pure manager helper driven by `savedTab.url`, then let `ManagerTabGrid` expose that result through stable data attributes that CSS can style. Avoid favicon pixel analysis entirely in v1; missing favicons and invalid URLs both stay deterministic through hostname hashing and a `neutral` fallback.

**Tech Stack:** TypeScript (`strict`), React 19, existing manager grid UI, Vitest, Playwright, shared CSS in `src/ui/shared/app-shell.css`

---

## File Map

- Create `src/ui/manager/card-color-family.ts`
  - Hold the pure hostname parser, deterministic hash, exported color-family type, and `neutral` fallback.
- Modify `src/ui/manager/ManagerTabGrid.tsx`
  - Resolve each card’s color family, expose `data-color-family` / `data-has-favicon`, and keep the existing open/restore/delete interactions unchanged.
- Modify `src/ui/shared/app-shell.css`
  - Add low-saturation card tint variables for each color family and stronger fallback-initial styling for cards without favicons.
- Create `tests/unit/ui/manager-card-color-family.test.ts`
  - Lock down deterministic hostname mapping and `neutral` fallback behavior.
- Modify `tests/unit/ui/manager-tab-grid.test.ts`
  - Verify the rendered markup exposes stable color-family and favicon-presence markers.
- Modify `tests/unit/ui/app-shell-styles.test.ts`
  - Freeze the new CSS selectors and fallback badge styling.
- Modify `tests/e2e/manager-workflows.spec.ts`
  - Confirm the extension-level manager page keeps color families stable when icons are missing and invalid URLs fall back to `neutral`.

## Task 1: Add a pure deterministic manager card color resolver

**Files:**
- Create: `src/ui/manager/card-color-family.ts`
- Create: `tests/unit/ui/manager-card-color-family.test.ts`

- [ ] **Step 1: Write the failing unit tests for stable hostname mapping**

Create `tests/unit/ui/manager-card-color-family.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  MANAGER_CARD_COLOR_FAMILIES,
  resolveManagerCardColorFamily
} from "../../../src/ui/manager/card-color-family";

describe("resolveManagerCardColorFamily", () => {
  it("should keep the same hostname in the same color family", () => {
    expect(resolveManagerCardColorFamily("https://example.com/docs")).toBe("orange");
    expect(resolveManagerCardColorFamily("https://example.com/blog")).toBe("orange");
  });

  it("should distribute different hostnames across the known family set", () => {
    expect(resolveManagerCardColorFamily("https://notion.so/roadmap")).toBe("green");
    expect(resolveManagerCardColorFamily("https://figma.com/file/123")).toBe("cyan");
    expect(resolveManagerCardColorFamily("https://dribbble.com/shots/123")).toBe("blue");
  });

  it("should fall back to neutral for invalid or hostless urls", () => {
    expect(resolveManagerCardColorFamily("not-a-valid-url")).toBe("neutral");
    expect(resolveManagerCardColorFamily("file:///Users/demo/readme.md")).toBe("neutral");
  });

  it("should expose the full declared family set", () => {
    expect(MANAGER_CARD_COLOR_FAMILIES).toEqual([
      "blue",
      "cyan",
      "green",
      "orange",
      "pink",
      "neutral"
    ]);
  });
});
```

- [ ] **Step 2: Run the new unit test to verify it fails**

Run: `npx vitest run tests/unit/ui/manager-card-color-family.test.ts`

Expected: FAIL with `Cannot find module '../../../src/ui/manager/card-color-family'`.

- [ ] **Step 3: Implement the pure color-family helper**

Create `src/ui/manager/card-color-family.ts`:

```ts
export const MANAGER_CARD_COLOR_FAMILIES = [
  "blue",
  "cyan",
  "green",
  "orange",
  "pink",
  "neutral"
] as const;

export type ManagerCardColorFamily = (typeof MANAGER_CARD_COLOR_FAMILIES)[number];

const HASHED_CARD_COLOR_FAMILIES: Exclude<ManagerCardColorFamily, "neutral">[] = [
  "blue",
  "cyan",
  "green",
  "orange",
  "pink"
];

function parseHostname(url: string): string | null {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.trim().toLowerCase();

    return hostname || null;
  } catch {
    return null;
  }
}

function hashHostname(hostname: string): number {
  let hash = 5381;

  for (const char of hostname) {
    hash = ((hash << 5) + hash + char.charCodeAt(0)) >>> 0;
  }

  return hash;
}

export function resolveManagerCardColorFamily(url: string): ManagerCardColorFamily {
  const hostname = parseHostname(url);

  if (!hostname) {
    return "neutral";
  }

  return HASHED_CARD_COLOR_FAMILIES[hashHostname(hostname) % HASHED_CARD_COLOR_FAMILIES.length];
}
```

- [ ] **Step 4: Run the unit test again**

Run: `npx vitest run tests/unit/ui/manager-card-color-family.test.ts`

Expected: PASS with all four resolver assertions green.

- [ ] **Step 5: Commit the pure helper**

```bash
git add src/ui/manager/card-color-family.ts tests/unit/ui/manager-card-color-family.test.ts
git commit -m "test: lock manager card color family mapping"
```

## Task 2: Freeze the extension-level contract before wiring the UI

**Files:**
- Modify: `tests/e2e/manager-workflows.spec.ts`

- [ ] **Step 1: Add failing Playwright coverage for stable card families and missing icons**

Extend `tests/e2e/manager-workflows.spec.ts`:

```ts
test("manager keeps card color families stable when icons are missing", async ({
  context,
  extensionId
}) => {
  const managerPage = await context.newPage();
  await seedManagerState(extensionId, managerPage, [
    {
      id: "session-1",
      title: "Tint Demo",
      createdAt: "2026-04-19T10:00:00.000Z",
      updatedAt: "2026-04-19T10:00:00.000Z",
      trashedAt: null,
      tabCount: 3,
      pinned: false,
      sourceWindowId: 1,
      tabs: [
        {
          id: "tab-1",
          title: "Example Docs",
          url: "https://example.com/docs",
          favIconUrl: null,
          createdAt: "2026-04-19T10:00:00.000Z",
          lastOpenedAt: null,
          originalIndex: 0
        },
        {
          id: "tab-2",
          title: "Example Home",
          url: "https://example.com/home",
          favIconUrl:
            "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Crect width='16' height='16' rx='4' fill='%231f4db8'/%3E%3C/svg%3E",
          createdAt: "2026-04-19T10:00:00.000Z",
          lastOpenedAt: null,
          originalIndex: 1
        },
        {
          id: "tab-3",
          title: "Broken Import",
          url: "not-a-valid-url",
          favIconUrl: null,
          createdAt: "2026-04-19T10:00:00.000Z",
          lastOpenedAt: null,
          originalIndex: 2
        }
      ]
    }
  ]);

  const cards = managerPage.locator(".manager-tab-card");

  await expect(cards).toHaveCount(3);
  await expect(cards.nth(0)).toHaveAttribute("data-color-family", "orange");
  await expect(cards.nth(1)).toHaveAttribute("data-color-family", "orange");
  await expect(cards.nth(2)).toHaveAttribute("data-color-family", "neutral");

  await expect(cards.nth(0).locator(".manager-tab-card__icon")).toHaveAttribute(
    "data-has-favicon",
    "false"
  );
  await expect(cards.nth(1).locator(".manager-tab-card__icon")).toHaveAttribute(
    "data-has-favicon",
    "true"
  );
  await expect(cards.nth(0).locator(".manager-tab-card__icon span")).toHaveText("E");
  await expect(cards.nth(1).locator(".manager-tab-card__icon img")).toBeVisible();
});
```

- [ ] **Step 2: Run the new manager E2E coverage and confirm it fails**

Run: `RUN_EXTENSION_E2E=1 npx playwright test tests/e2e/manager-workflows.spec.ts -g "manager keeps card color families stable when icons are missing"`

Expected: FAIL because `.manager-tab-card` does not expose `data-color-family` or `data-has-favicon` yet.

- [ ] **Step 3: Commit the failing browser contract**

```bash
git add tests/e2e/manager-workflows.spec.ts
git commit -m "test: add manager card tint e2e coverage"
```

## Task 3: Expose color families through `ManagerTabGrid`

**Files:**
- Modify: `src/ui/manager/ManagerTabGrid.tsx`
- Modify: `tests/unit/ui/manager-tab-grid.test.ts`
- Test: `tests/e2e/manager-workflows.spec.ts`

- [ ] **Step 1: Add failing component coverage for card family markers**

Append to `tests/unit/ui/manager-tab-grid.test.ts`:

```ts
it("should attach stable color markers for cards with and without favicons", () => {
  const markup = renderToStaticMarkup(
    createElement(ManagerTabGrid, {
      busyKey: null,
      density: "enhanced",
      dragOverTabId: null,
      draggedTabId: null,
      isAutoDowngraded: false,
      isInteractive: true,
      isTabDropAtEnd: false,
      onClearDragState: () => {},
      onDeleteTab: () => {},
      onOpenTab: () => {},
      onRestoreTab: () => {},
      showRestoreAction: true,
      onTabDragOver: () => {},
      onTabDragStart: () => {},
      onTabDrop: () => {},
      sessionId: "session-1",
      tabs: [
        {
          id: "tab-1",
          title: "Example Docs",
          url: "https://example.com/docs",
          favIconUrl: null,
          createdAt: "2026-05-24T12:00:00.000Z",
          lastOpenedAt: null,
          originalIndex: 0
        },
        {
          id: "tab-2",
          title: "Example Home",
          url: "https://example.com/home",
          favIconUrl:
            "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Crect width='16' height='16' rx='4' fill='%231f4db8'/%3E%3C/svg%3E",
          createdAt: "2026-05-24T12:00:00.000Z",
          lastOpenedAt: null,
          originalIndex: 1
        },
        {
          id: "tab-3",
          title: "Broken Import",
          url: "not-a-valid-url",
          favIconUrl: null,
          createdAt: "2026-05-24T12:00:00.000Z",
          lastOpenedAt: null,
          originalIndex: 2
        }
      ]
    })
  );

  expect(markup).toContain('data-color-family="orange"');
  expect(markup).toContain('data-color-family="neutral"');
  expect(markup).toContain('data-has-favicon="false"');
  expect(markup).toContain('data-has-favicon="true"');
  expect(markup).toContain(">E</span>");
});
```

- [ ] **Step 2: Run the component test to verify it fails**

Run: `npx vitest run tests/unit/ui/manager-tab-grid.test.ts`

Expected: FAIL because the rendered markup does not contain the new `data-color-family` and `data-has-favicon` markers.

- [ ] **Step 3: Wire the color-family helper into `ManagerTabGrid`**

Update `src/ui/manager/ManagerTabGrid.tsx`:

```tsx
import { resolveManagerCardColorFamily } from "./card-color-family";

export function ManagerTabGrid({
  density,
  isAutoDowngraded,
  isInteractive,
  showRestoreAction,
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

  return (
    <div
      className="manager-tab-grid"
      data-auto-downgraded={isAutoDowngraded ? "true" : "false"}
      data-density={density}
      style={gridStyle}
    >
      {tabs.map((savedTab) => {
        const actionsVisible = revealedActionTabId === savedTab.id;
        const colorFamily = resolveManagerCardColorFamily(savedTab.url);
        const hasFavicon = Boolean(savedTab.favIconUrl);

        return (
          <article
            className={`manager-tab-card ${draggedTabId === savedTab.id ? "manager-tab-card--dragging" : ""} ${dragOverTabId === savedTab.id ? "manager-tab-card--drop-target" : ""}`}
            data-actions-visible={actionsVisible ? "true" : "false"}
            data-color-family={colorFamily}
            key={savedTab.id}
            onBlur={(event) => handleCardBlur(event, savedTab.id)}
            onFocus={() => setRevealedActionTabId(savedTab.id)}
            onPointerDown={(event) => handleCardPointerDown(event, savedTab.id)}
          >
            <div
              aria-label={isInteractive ? `打开 “${savedTab.title}”` : undefined}
              className="manager-tab-card__body"
              draggable={isInteractive}
              onClick={() => handleCardDefaultAction(sessionId, savedTab.id)}
              onDragEnd={onClearDragState}
              onDragOver={(event) => onTabDragOver(event, sessionId, savedTab.id)}
              onDragStart={(event) => onTabDragStart(event, sessionId, savedTab.id)}
              onDrop={(event) => void onTabDrop(event, sessionId, savedTab.id)}
              onKeyDown={(event) => handleCardDefaultActionKeyDown(event, sessionId, savedTab.id)}
              role={isInteractive ? "button" : undefined}
              tabIndex={isInteractive ? 0 : -1}
            >
              <div
                className="manager-tab-card__icon"
                data-color-family={colorFamily}
                data-has-favicon={hasFavicon ? "true" : "false"}
              >
                {hasFavicon ? (
                  <img alt="" src={savedTab.favIconUrl ?? undefined} />
                ) : (
                  <span>{savedTab.title.slice(0, 1).toUpperCase()}</span>
                )}
              </div>

              <div className="manager-tab-card__copy">
                <strong>{savedTab.title}</strong>
                <span>{getTabHostname(savedTab.url)}</span>
                {density === "enhanced" ? (
                  <small className="manager-tab-card__meta">{buildTabMeta(savedTab)}</small>
                ) : null}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run the component and browser contract tests again**

Run: `npx vitest run tests/unit/ui/manager-tab-grid.test.ts`

Expected: PASS with the new markup assertions green.

Run: `RUN_EXTENSION_E2E=1 npx playwright test tests/e2e/manager-workflows.spec.ts -g "manager keeps card color families stable when icons are missing"`

Expected: PASS with both `example.com` cards staying `orange` and the invalid URL card falling back to `neutral`.

- [ ] **Step 5: Commit the grid markup wiring**

```bash
git add src/ui/manager/ManagerTabGrid.tsx tests/unit/ui/manager-tab-grid.test.ts
git commit -m "feat: expose manager card tint markers"
```

## Task 4: Add the low-saturation tint system and run the full quality gate

**Files:**
- Modify: `src/ui/shared/app-shell.css`
- Modify: `tests/unit/ui/app-shell-styles.test.ts`

- [ ] **Step 1: Write the failing CSS regression tests**

Append to `tests/unit/ui/app-shell-styles.test.ts`:

```ts
it("should tint manager cards through stable color-family variables", () => {
  const css = readFileSync(resolve(process.cwd(), "src/ui/shared/app-shell.css"), "utf8");

  expect(css).toMatch(
    /\.manager-tab-card\s*\{[\s\S]*--manager-card-tint-top:\s*rgba\(251,\s*248,\s*242,\s*0\.98\);[\s\S]*background:\s*linear-gradient\(180deg,\s*var\(--manager-card-tint-top\),\s*var\(--manager-card-tint-bottom\)\);[\s\S]*\}/
  );
  expect(css).toMatch(
    /\.manager-tab-card\[data-color-family="blue"\]\s*\{[\s\S]*--manager-card-tint-top:\s*rgba\(242,\s*247,\s*255,\s*0\.98\);[\s\S]*--manager-card-icon-tint:\s*rgba\(93,\s*140,\s*242,\s*0\.14\);[\s\S]*\}/
  );
  expect(css).toMatch(
    /\.manager-tab-card\[data-color-family="neutral"\]\s*\{[\s\S]*--manager-card-fallback-badge:\s*#7b6447;[\s\S]*\}/
  );
});

it("should render fallback initials as a stronger badge when favicons are missing", () => {
  const css = readFileSync(resolve(process.cwd(), "src/ui/shared/app-shell.css"), "utf8");

  expect(css).toMatch(
    /\.manager-tab-card__icon\[data-has-favicon="false"\]\s*span\s*\{[\s\S]*display:\s*inline-flex;[\s\S]*width:\s*24px;[\s\S]*height:\s*24px;[\s\S]*background:\s*var\(--manager-card-fallback-badge\);[\s\S]*color:\s*#fff;[\s\S]*\}/
  );
});
```

- [ ] **Step 2: Run the style test to verify it fails**

Run: `npx vitest run tests/unit/ui/app-shell-styles.test.ts`

Expected: FAIL because the manager card tint variables and fallback badge selectors do not exist yet.

- [ ] **Step 3: Implement the tint variables and fallback badge styling**

Update `src/ui/shared/app-shell.css`:

```css
.manager-tab-card {
  --manager-card-tint-top: rgba(251, 248, 242, 0.98);
  --manager-card-tint-bottom: rgba(244, 239, 230, 0.96);
  --manager-card-icon-tint: rgba(24, 33, 38, 0.08);
  --manager-card-fallback-badge: #7b6447;
  display: flex;
  flex-direction: column;
  min-height: 156px;
  border: 1px solid rgba(24, 33, 38, 0.1);
  border-radius: 18px;
  background: linear-gradient(180deg, var(--manager-card-tint-top), var(--manager-card-tint-bottom));
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.45) inset,
    0 16px 30px rgba(24, 33, 38, 0.08);
  outline: none;
  transition:
    transform 160ms ease,
    box-shadow 160ms ease;
}

.manager-tab-card[data-color-family="blue"] {
  --manager-card-tint-top: rgba(242, 247, 255, 0.98);
  --manager-card-tint-bottom: rgba(232, 241, 255, 0.96);
  --manager-card-icon-tint: rgba(93, 140, 242, 0.14);
  --manager-card-fallback-badge: #5d8cf2;
}

.manager-tab-card[data-color-family="cyan"] {
  --manager-card-tint-top: rgba(240, 249, 251, 0.98);
  --manager-card-tint-bottom: rgba(231, 245, 248, 0.96);
  --manager-card-icon-tint: rgba(76, 159, 180, 0.14);
  --manager-card-fallback-badge: #4c9fb4;
}

.manager-tab-card[data-color-family="green"] {
  --manager-card-tint-top: rgba(244, 250, 242, 0.98);
  --manager-card-tint-bottom: rgba(236, 246, 234, 0.96);
  --manager-card-icon-tint: rgba(95, 157, 99, 0.14);
  --manager-card-fallback-badge: #5f9d63;
}

.manager-tab-card[data-color-family="orange"] {
  --manager-card-tint-top: rgba(255, 248, 237, 0.98);
  --manager-card-tint-bottom: rgba(255, 242, 225, 0.96);
  --manager-card-icon-tint: rgba(201, 139, 43, 0.15);
  --manager-card-fallback-badge: #c98b2b;
}

.manager-tab-card[data-color-family="pink"] {
  --manager-card-tint-top: rgba(255, 242, 246, 0.98);
  --manager-card-tint-bottom: rgba(255, 236, 241, 0.96);
  --manager-card-icon-tint: rgba(203, 91, 125, 0.14);
  --manager-card-fallback-badge: #cb5b7d;
}

.manager-tab-card[data-color-family="neutral"] {
  --manager-card-tint-top: rgba(251, 248, 242, 0.98);
  --manager-card-tint-bottom: rgba(244, 239, 230, 0.96);
  --manager-card-icon-tint: rgba(24, 33, 38, 0.08);
  --manager-card-fallback-badge: #7b6447;
}

.manager-tab-card__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: var(--manager-card-icon-tint);
  overflow: hidden;
}

.manager-tab-card__icon[data-has-favicon="false"] span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 8px;
  background: var(--manager-card-fallback-badge);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  line-height: 1;
}
```

- [ ] **Step 4: Run the focused tests to verify the tint system works**

Run: `npx vitest run tests/unit/ui/app-shell-styles.test.ts tests/unit/ui/manager-card-color-family.test.ts tests/unit/ui/manager-tab-grid.test.ts`

Expected: PASS with CSS, resolver, and markup coverage all green.

- [ ] **Step 5: Run the repository quality gate**

Run: `npm run lint`

Expected: PASS with no ESLint errors.

Run: `npm run typecheck`

Expected: PASS with no TypeScript errors.

Run: `npm run test`

Expected: PASS with the full Vitest suite green.

Run: `RUN_EXTENSION_E2E=1 npm run test:e2e`

Expected: PASS with the manager workflow regression included in the Playwright run.

- [ ] **Step 6: Commit the final tint system**

```bash
git add src/ui/shared/app-shell.css tests/unit/ui/app-shell-styles.test.ts
git commit -m "feat: tint manager cards with stable color families"
```
