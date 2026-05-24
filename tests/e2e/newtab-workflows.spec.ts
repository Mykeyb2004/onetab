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
            managerGridDensityPreference: "enhanced",
            managerSidebarPreference: "expanded"
          },
          sessions: nextSessions
        }
      });
    },
    { storageKey: ROOT_STORAGE_KEY, nextSessions: sessions }
  );
  await page.reload();
}

test("new tab opens the full manager interface when no sessions exist", async ({ context }) => {
  const page = await context.newPage();
  await page.goto("chrome://newtab/");

  await expect(page.getByRole("heading", { name: "TabVault Manager" })).toBeVisible();
  await expect(page.getByPlaceholder("搜索分组、标题或 URL")).toBeVisible();
  await expect(page.locator(".manager-empty-state")).toBeVisible();
});

test("new tab loads seeded sessions in the full manager interface", async ({ context }) => {
  const page = await context.newPage();
  await seedNewTabState(page, [createSeededSession("session-1", "Research Bundle", 2)]);

  await expect(page.getByRole("heading", { name: "TabVault Manager" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Research Bundle" })).toBeVisible();
  await expect(page.locator(".manager-density-toggle")).toBeVisible();
});
