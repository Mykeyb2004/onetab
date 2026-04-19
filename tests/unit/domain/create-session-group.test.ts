import { describe, expect, it } from "vitest";
import { createSessionGroup } from "../../../src/domain/sessions/create-session-group";

describe("createSessionGroup", () => {
  it("should assign a default title using the approved timestamp format", () => {
    const group = createSessionGroup(
      [{ url: "https://example.com", title: "Example", index: 0 }],
      {
        now: new Date(2026, 3, 19, 14, 30),
        sourceWindowId: 12
      }
    );

    expect(group.title).toBe("保存于 2026-04-19 14:30");
    expect(group.sourceWindowId).toBe(12);
    expect(group.tabCount).toBe(1);
  });

  it("should preserve url metadata and fallback tab titles", () => {
    const group = createSessionGroup(
      [
        { url: "https://example.com/a", title: "  Example A  ", index: 3 },
        { url: "https://example.com/b", index: 5 }
      ],
      {
        now: new Date(2026, 3, 19, 9, 0)
      }
    );

    expect(group.tabs[0].title).toBe("Example A");
    expect(group.tabs[0].originalIndex).toBe(3);
    expect(group.tabs[1].title).toBe("https://example.com/b");
    expect(group.tabs[1].originalIndex).toBe(5);
  });
});
