type ManagerBulkActionBucket = "active" | "trash";

export interface ManagerBulkActionToolbarProps {
  bucket: ManagerBulkActionBucket;
  disabled: boolean;
  selectedCount: number;
  onCancel: () => void;
  onMoveToTrash: () => void | Promise<void>;
  onMergeIntoNotes: () => void | Promise<void>;
  onRestore: () => void | Promise<void>;
  onPermanentDelete: () => void | Promise<void>;
}

export function ManagerBulkActionToolbar({
  bucket,
  disabled,
  selectedCount,
  onCancel,
  onMoveToTrash,
  onMergeIntoNotes,
  onRestore,
  onPermanentDelete
}: ManagerBulkActionToolbarProps) {
  const actionDisabled = disabled || selectedCount === 0;
  const ariaLabel = bucket === "active" ? "全部分组批量操作" : "回收站分组批量操作";

  return (
    <div aria-label={ariaLabel} className="manager-tree__batch-toolbar" role="group">
      <span className="manager-tree__batch-count">已选 {selectedCount} 个</span>
      <div className="manager-tree__batch-actions">
        {bucket === "active" ? (
          <>
            <button
              className="button button--quiet button--small"
              disabled={actionDisabled}
              onClick={() => void onMoveToTrash()}
              type="button"
            >
              移到回收站
            </button>
            <button
              className="button button--secondary button--small"
              disabled={actionDisabled}
              onClick={() => void onMergeIntoNotes()}
              type="button"
            >
              合并入笔记
            </button>
          </>
        ) : (
          <>
            <button
              className="button button--quiet button--small"
              disabled={actionDisabled}
              onClick={() => void onRestore()}
              type="button"
            >
              恢复
            </button>
            <button
              className="button button--secondary button--small"
              disabled={actionDisabled}
              onClick={() => void onPermanentDelete()}
              type="button"
            >
              永久删除
            </button>
          </>
        )}
        <button className="button button--quiet button--small" disabled={disabled} onClick={onCancel} type="button">
          取消
        </button>
      </div>
    </div>
  );
}
