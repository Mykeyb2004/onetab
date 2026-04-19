import { describe, expect, it } from "vitest";
import { isSupportedTabUrl } from "../../../src/domain/tabs/is-supported-tab-url";

describe("isSupportedTabUrl", () => {
  it("should accept standard web and file urls", () => {
    expect(isSupportedTabUrl("https://example.com")).toBe(true);
    expect(isSupportedTabUrl("http://example.com")).toBe(true);
    expect(isSupportedTabUrl("file:///tmp/demo.txt")).toBe(true);
  });

  it("should reject unsupported browser-specific urls", () => {
    expect(isSupportedTabUrl("chrome://extensions")).toBe(false);
    expect(isSupportedTabUrl("chrome-extension://abcdef/page.html")).toBe(false);
    expect(isSupportedTabUrl("about:blank")).toBe(false);
    expect(isSupportedTabUrl(undefined)).toBe(false);
  });
});
