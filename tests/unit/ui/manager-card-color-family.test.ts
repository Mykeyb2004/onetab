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
