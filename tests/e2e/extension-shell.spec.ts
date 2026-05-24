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

  await expect(managerPage.getByRole("heading", { name: "TabVault Manager" })).toBeVisible();
  await expect(managerPage.getByPlaceholder("搜索分组、标题或 URL")).toBeVisible();

  const newTabPage = await context.newPage();
  await newTabPage.goto("chrome://newtab/");

  await expect(newTabPage.getByRole("heading", { name: "TabVault Manager" })).toBeVisible();
  await expect(newTabPage.getByPlaceholder("搜索分组、标题或 URL")).toBeVisible();
});
