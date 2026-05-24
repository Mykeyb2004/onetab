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

async function seedManagerState(
  extensionId: string,
  managerPage: import("@playwright/test").Page,
  sessions = [
    {
      id: "session-1",
      title: "Research Bundle",
      createdAt: "2026-04-19T10:00:00.000Z",
      updatedAt: "2026-04-19T10:00:00.000Z",
      trashedAt: null,
      tabCount: 2,
      pinned: false,
      sourceWindowId: 1,
      tabs: [
        {
          id: "tab-1",
          title: "React Compiler",
          url: "https://example.com/react-compiler",
          favIconUrl: null,
          createdAt: "2026-04-19T10:00:00.000Z",
          lastOpenedAt: null,
          originalIndex: 0
        },
        {
          id: "tab-2",
          title: "Testing Docs",
          url: "https://docs.example.com/testing",
          favIconUrl: null,
          createdAt: "2026-04-19T10:00:00.000Z",
          lastOpenedAt: null,
          originalIndex: 1
        }
      ]
    }
  ]
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

test("manager can search, rename, pin, and delete seeded sessions", async ({
  context,
  extensionId
}) => {
  const managerPage = await context.newPage();
  await seedManagerState(extensionId, managerPage);

  await managerPage.getByLabel("搜索分组、标题或 URL").fill("research");
  await expect(managerPage.getByRole("heading", { name: "Research Bundle" })).toBeVisible();

  managerPage.once("dialog", async (dialog) => {
    await dialog.accept("Renamed Bundle");
  });
  await managerPage.getByRole("button", { name: "分组操作：Research Bundle" }).click();
  await managerPage.getByRole("menuitem", { name: "重命名" }).click();
  await expect(managerPage.getByRole("heading", { name: "Renamed Bundle" })).toBeVisible();

  await managerPage.getByRole("button", { name: "分组操作：Renamed Bundle" }).click();
  await managerPage.getByRole("menuitem", { name: "固定分组" }).click();
  await expect(managerPage.getByRole("heading", { name: "📌 Renamed Bundle" })).toBeVisible();

  managerPage.once("dialog", async (dialog) => {
    await dialog.accept();
  });
  await managerPage.getByRole("button", { name: "分组操作：Renamed Bundle" }).click();
  await managerPage.getByRole("menuitem", { name: "移到回收站" }).click();
  await managerPage.getByRole("button", { name: /回收站/ }).first().click();
  await expect(managerPage.getByRole("heading", { name: "📌 Renamed Bundle" })).toBeVisible();
});

test("manager can restore a tab from seeded session state", async ({
  context,
  extensionId
}) => {
  const managerPage = await context.newPage();
  await seedManagerState(extensionId, managerPage);

  await managerPage.locator(".manager-tab-card__body").first().focus();
  await managerPage.locator('button[aria-label="还原并移除 “React Compiler”"]').click();
  await expect(managerPage.getByText("Testing Docs")).toBeVisible();
  await expect(managerPage.getByText("React Compiler")).toHaveCount(0);
});

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

test("manager persists the selected grid density after reload", async ({
  context,
  extensionId
}) => {
  const managerPage = await context.newPage();
  await seedManagerState(extensionId, managerPage, [
    createSeededSession("session-1", "Long Session", 6)
  ]);

  await expect(managerPage.locator(".manager-density-toggle")).toBeVisible();
  await managerPage.locator(".manager-density-toggle").getByRole("button", { name: "简洁" }).click();
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
  await seedManagerState(extensionId, managerPage, [
    createSeededSession("session-1", "Long Session", 8)
  ]);

  await managerPage.getByRole("button", { name: "增强" }).click();
  await expectGridDensity(managerPage, "enhanced");

  await managerPage.setViewportSize({ width: 820, height: 900 });
  await expect(managerPage.locator(".manager-tab-grid")).toHaveAttribute(
    "data-auto-downgraded",
    "true"
  );
  await expectGridDensity(managerPage, "compact");

  await managerPage.setViewportSize({ width: 1440, height: 900 });
  await expect(managerPage.locator(".manager-tab-grid")).toHaveAttribute(
    "data-auto-downgraded",
    "false"
  );
  await expectGridDensity(managerPage, "enhanced");
});

test("manager exposes icon actions on focused cards without triggering drag", async ({
  context,
  extensionId
}) => {
  const managerPage = await context.newPage();
  await seedManagerState(extensionId, managerPage);

  const firstCardBody = managerPage.locator(".manager-tab-card__body").first();
  await firstCardBody.focus();

  await expect(managerPage.locator('button[aria-label="还原并移除 “React Compiler”"]')).toBeVisible();
  await managerPage
    .locator('button[aria-label="还原并移除 “React Compiler”"]')
    .click();

  await expect(managerPage.getByText("Testing Docs")).toBeVisible();
  await expect(managerPage.getByText("React Compiler")).toHaveCount(0);
});

test("manager hides the restore action for pinned groups", async ({
  context,
  extensionId
}) => {
  const managerPage = await context.newPage();
  await seedManagerState(extensionId, managerPage, [
    {
      ...createSeededSession("session-1", "Pinned Research", 2),
      pinned: true
    }
  ]);

  await expect(managerPage.getByRole("heading", { name: "Pinned Research" })).toBeVisible();
  const firstCardBody = managerPage.locator(".manager-tab-card__body").first();
  await firstCardBody.focus();

  await expect(managerPage.locator('button[aria-label="打开 “Pinned Research Tab 1”"]')).toBeVisible();
  await expect(managerPage.locator('button[aria-label="删除 “Pinned Research Tab 1”"]')).toBeVisible();
  await expect(managerPage.locator('button[aria-label="还原并移除 “Pinned Research Tab 1”"]')).toHaveCount(0);
});

test("manager opens the saved tab when the card body is clicked", async ({
  context,
  extensionId
}) => {
  const managerPage = await context.newPage();
  await seedManagerState(extensionId, managerPage);

  const openedPagePromise = context.waitForEvent("page");
  await managerPage.locator(".manager-tab-card__body").first().click();

  const openedPage = await openedPagePromise;
  await openedPage.waitForLoadState("domcontentloaded");

  await expect.poll(() => openedPage.url()).toBe("https://example.com/react-compiler");
  await expect(managerPage.getByText("Testing Docs")).toBeVisible();
});
