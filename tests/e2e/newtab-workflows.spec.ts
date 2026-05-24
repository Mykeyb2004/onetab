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

  await expect(page.locator(".card strong", { hasText: "No saved sessions yet." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open Manager" })).toBeVisible();
});

test("new tab can restore the latest session without opening manager", async ({ context }) => {
  const page = await context.newPage();
  await seedNewTabState(page, [createSeededSession("session-1", "Research Bundle", 2)]);

  await page.getByRole("button", { name: "Restore Latest Group" }).click();

  await expect(page.getByText("Restored 2 tab(s) in a new window.")).toBeVisible();
  await expect(page.getByText("Research Bundle")).not.toBeVisible();
});

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
