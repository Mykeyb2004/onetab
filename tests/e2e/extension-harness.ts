import { chromium, test as base, expect } from "@playwright/test";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

type ExtensionFixtures = {
  extensionId: string;
};

export const test = base.extend<ExtensionFixtures>({
  context: async ({ browserName }, runFixture, testInfo) => {
    void browserName;
    const extensionPath = resolve(process.cwd(), "dist");
    const systemChromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
    const context = await chromium.launchPersistentContext(testInfo.outputPath("user-data-dir"), {
      channel: existsSync(systemChromePath) ? undefined : "chromium",
      executablePath: existsSync(systemChromePath) ? systemChromePath : undefined,
      headless: false,
      ignoreDefaultArgs: ["--disable-extensions"],
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`
      ]
    });

    await runFixture(context);
    await context.close();
  },

  extensionId: async ({ context }, runFixture) => {
    let [serviceWorker] = context.serviceWorkers();

    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent("serviceworker");
    }

    const extensionId = new URL(serviceWorker.url()).host;
    await runFixture(extensionId);
  }
});

export { expect };
