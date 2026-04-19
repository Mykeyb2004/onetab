import { describe, expect, it, vi } from "vitest";
import { executeCaptureRuntimeAction } from "../../../src/background/execute-capture-runtime-action";
import { createDefaultRootState } from "../../../src/storage/local/schema";
import type { ExtensionStorageArea } from "../../../src/storage/local/repository";

function createMemoryStorage(showCaptureFeedback: boolean): ExtensionStorageArea {
  const rootState = createDefaultRootState();
  rootState.settings.showCaptureFeedback = showCaptureFeedback;

  return {
    async get(key) {
      return {
        [key]: rootState
      };
    },
    async set() {},
    async remove() {}
  };
}

describe("executeCaptureRuntimeAction", () => {
  it("should show a notification when capture feedback is enabled", async () => {
    const showCaptureFeedback = vi.fn(async () => {});

    const response = await executeCaptureRuntimeAction(
      async () => ({
        ok: true,
        message: "Saved 2 tab(s) to TabVault.",
        createdGroupId: "session-1",
        capturedCount: 2,
        skippedCount: 0,
        closedCount: 2
      }),
      {
        storage: createMemoryStorage(true),
        notifications: {
          showCaptureFeedback
        }
      }
    );

    expect(showCaptureFeedback).toHaveBeenCalledWith("Saved 2 tab(s) to TabVault.");
    expect(response.ok).toBe(true);
  });

  it("should skip notification when capture feedback is disabled", async () => {
    const showCaptureFeedback = vi.fn(async () => {});

    await executeCaptureRuntimeAction(
      async () => ({
        ok: true,
        message: "Saved 1 tab(s) to TabVault.",
        createdGroupId: "session-1",
        capturedCount: 1,
        skippedCount: 0,
        closedCount: 1
      }),
      {
        storage: createMemoryStorage(false),
        notifications: {
          showCaptureFeedback
        }
      }
    );

    expect(showCaptureFeedback).not.toHaveBeenCalled();
  });
});
