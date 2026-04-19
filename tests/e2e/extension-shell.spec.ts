import { expect, test } from "./extension-harness";

test.skip(
  !process.env.RUN_EXTENSION_E2E,
  "Set RUN_EXTENSION_E2E=1 when running browser-backed extension E2E on a machine with Chrome access."
);

test("loads popup and manager pages for the unpacked extension", async ({
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
});
