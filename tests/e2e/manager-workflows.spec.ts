import { expect, test } from "./extension-harness";

test.skip(
  !process.env.RUN_EXTENSION_E2E,
  "Set RUN_EXTENSION_E2E=1 when running browser-backed extension E2E on a machine with Chrome access."
);

const ROOT_STORAGE_KEY = "tabvault:root";

async function seedManagerState(extensionId: string, managerPage: import("@playwright/test").Page) {
  await managerPage.goto(`chrome-extension://${extensionId}/manager.html`);
  await managerPage.evaluate(async ([storageKey]) => {
    await chrome.storage.local.set({
      [storageKey]: {
        schemaVersion: 1,
        settings: {
          restoreBehavior: "remove-group",
          defaultClickAction: "capture-current-window",
          showCaptureFeedback: true,
          enableContextMenu: true
        },
        sessions: [
          {
            id: "session-1",
            title: "Research Bundle",
            createdAt: "2026-04-19T10:00:00.000Z",
            updatedAt: "2026-04-19T10:00:00.000Z",
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
      }
    });
  }, [ROOT_STORAGE_KEY]);

  await managerPage.reload();
}

test("manager can search, rename, pin, and delete seeded sessions", async ({
  context,
  extensionId
}) => {
  const managerPage = await context.newPage();
  await seedManagerState(extensionId, managerPage);

  await managerPage.getByLabel("Search group name, tab title, or URL").fill("research");
  await expect(managerPage.getByText("Research Bundle")).toBeVisible();

  managerPage.once("dialog", async (dialog) => {
    await dialog.accept("Renamed Bundle");
  });
  await managerPage.getByRole("button", { name: "Rename" }).click();
  await expect(managerPage.getByText("Renamed Bundle")).toBeVisible();

  await managerPage.getByRole("button", { name: "Pin" }).click();
  await expect(managerPage.getByText("Pinned · Renamed Bundle")).toBeVisible();

  managerPage.once("dialog", async (dialog) => {
    await dialog.accept();
  });
  await managerPage.getByRole("button", { name: "Delete Group" }).click();
  await expect(managerPage.getByText("No saved sessions yet.")).toBeVisible();
});

test("manager can restore a tab from seeded session state", async ({
  context,
  extensionId
}) => {
  const managerPage = await context.newPage();
  await seedManagerState(extensionId, managerPage);

  await managerPage.getByRole("button", { name: "Restore Tab" }).first().click();
  await expect(managerPage.getByText(/Restored 1 tab/)).toBeVisible();
  await expect(managerPage.getByText("Testing Docs")).toBeVisible();
});
