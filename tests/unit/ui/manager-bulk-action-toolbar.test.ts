import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ManagerBulkActionToolbar } from "../../../src/ui/manager/ManagerBulkActionToolbar";

describe("ManagerBulkActionToolbar", () => {
  it("should render active group batch actions", () => {
    const markup = renderToStaticMarkup(
      createElement(ManagerBulkActionToolbar, {
        bucket: "active",
        disabled: false,
        selectedCount: 2,
        onCancel: () => {},
        onMoveToTrash: () => {},
        onMergeIntoNotes: () => {},
        onRestore: () => {},
        onPermanentDelete: () => {}
      })
    );

    expect(markup).toContain("已选 2 个");
    expect(markup).toContain("移到回收站");
    expect(markup).toContain("合并入笔记");
    expect(markup).not.toContain("恢复");
    expect(markup).not.toContain("永久删除");
  });

  it("should render trash group batch actions", () => {
    const markup = renderToStaticMarkup(
      createElement(ManagerBulkActionToolbar, {
        bucket: "trash",
        disabled: false,
        selectedCount: 3,
        onCancel: () => {},
        onMoveToTrash: () => {},
        onMergeIntoNotes: () => {},
        onRestore: () => {},
        onPermanentDelete: () => {}
      })
    );

    expect(markup).toContain("已选 3 个");
    expect(markup).toContain("恢复");
    expect(markup).toContain("永久删除");
    expect(markup).not.toContain("移到回收站");
    expect(markup).not.toContain("合并入笔记");
  });

  it("should disable mutation actions when no groups are selected", () => {
    const markup = renderToStaticMarkup(
      createElement(ManagerBulkActionToolbar, {
        bucket: "active",
        disabled: false,
        selectedCount: 0,
        onCancel: () => {},
        onMoveToTrash: () => {},
        onMergeIntoNotes: () => {},
        onRestore: () => {},
        onPermanentDelete: () => {}
      })
    );

    expect(markup).toContain("已选 0 个");
    expect(markup).toContain("disabled=\"\"");
  });
});
