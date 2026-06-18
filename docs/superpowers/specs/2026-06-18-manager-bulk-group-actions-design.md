# Manager Bulk Group Actions Design

Last updated: 2026-06-18

Status: Pending user review

Scope: Add batch selection and batch actions for session groups in the Manager sidebar.

Related files:

- `src/ui/manager/App.tsx`
- `src/features/sessions/delete-session-group.ts`
- `src/features/sessions/delete-session-group-permanently.ts`
- `src/features/sessions/restore-session-group-from-trash.ts`
- `src/features/sessions/create-empty-session-group.ts`
- `src/domain/sessions/default-notes-group.ts`
- `src/domain/sessions/session-groups.ts`
- `src/types/session.ts`

## Problem

The Manager sidebar currently supports single-group operations through each group's `...` menu. This works for occasional edits, but it is slow when the user needs to clean up many captured groups or consolidate several groups into the default notes group.

The requested feature is group-level batch operation support for both active groups and trash groups.

## Goals

1. Let users select multiple active groups and move them to trash together.
2. Let users select multiple active groups and merge their tabs into the `笔记` group together.
3. Let users select multiple trash groups and restore them together.
4. Let users select multiple trash groups and permanently delete them together.
5. Keep existing single-group operations, group selection, and drag behavior intact outside selection mode.
6. Keep core persistence and transformation logic outside React components.

## Non-Goals

1. Batch actions for individual saved tabs.
2. Batch moving active groups into arbitrary user-selected groups.
3. Batch merging trash groups into `笔记`.
4. Undo support for permanent deletion.
5. Cloud sync, sharing, or account-level behavior.

## Confirmed Decisions

1. The batch feature applies to both sidebar sections: `全部` and `回收站`.
2. Active groups support `移到回收站` and `合并入笔记`.
3. Trash groups support `恢复` and `永久删除`.
4. If the active `笔记` group does not exist during merge, the app creates it automatically.
5. After merging selected active groups into `笔记`, the source groups are removed from storage directly. They are not moved to trash.
6. The active `笔记` group must not be deleted as a merge source. The UI should prevent selecting it for the merge operation.

## Interaction Design

The Manager sidebar gains a lightweight selection mode.

Default mode remains unchanged:

- Clicking a group selects it and shows its details.
- The `...` menu opens single-group actions.
- Active groups remain draggable for existing reorder and tab-drop flows.
- Trash groups keep their existing restore and permanent-delete menu actions.

Selection mode:

- Each group row shows a checkbox.
- Clicking a selectable group row toggles its checkbox instead of changing the detail selection.
- A batch action toolbar appears near the relevant sidebar area.
- The toolbar shows the selected count, a cancel-selection action, and actions for the current bucket.
- The active bucket toolbar offers `移到回收站` and `合并入笔记`.
- The trash bucket toolbar offers `恢复` and `永久删除`.
- Batch actions are disabled while another operation is busy.
- Batch actions show confirmation prompts before mutating storage.

The selection state is bucket-aware:

- Active selections contain only active group ids.
- Trash selections contain only trash group ids.
- Switching buckets does not accidentally apply active actions to trash ids or trash actions to active ids.
- Reloading collections after an operation prunes selections for groups that no longer exist.

The `笔记` group behavior in active selection mode:

- `笔记` remains visible in the active list.
- It can still be selected as the current detail group in default mode.
- The active `笔记` group is disabled in selection mode and cannot be included in active batch actions.
- Users can still operate on `笔记` through the existing single-group menu outside selection mode.

## Data Behavior

### Batch Move Active Groups To Trash

Given selected active group ids:

1. Read root state once.
2. Validate that each selected id belongs to an active group.
3. Apply the same timestamp to all selected groups for `trashedAt` and `updatedAt`.
4. Write root state once.
5. Reload Manager collections and clear the affected active selections.

This should preserve all tabs and metadata so the groups remain recoverable from trash.

### Batch Merge Active Groups Into Notes

Given selected active group ids:

1. Read root state once.
2. Find the active `笔记` group by title.
3. If no active `笔记` group exists, create it in the same write transaction.
4. Exclude the `笔记` target from source ids if it appears in the selected set.
5. Append all tabs from source groups to the target `笔记` group.
6. Reassign appended tabs' `originalIndex` values so they continue after the target group's current maximum `originalIndex`.
7. Update the target `tabCount` and `updatedAt`.
8. Remove source groups from storage directly.
9. Write root state once.
10. Reload Manager collections, select the updated `笔记` group, and clear active selections.

The operation is intentionally a move-and-remove merge, not a copy. Once it succeeds, the original source groups no longer exist as standalone groups.

If every selected source is invalid or resolves only to the target `笔记` group, the feature should fail with a user-readable message and avoid writing state.

### Batch Restore Trash Groups

Given selected trash group ids:

1. Read root state once.
2. Validate that each selected id belongs to a trash group.
3. Set `trashedAt` to `null` and update `updatedAt` for each selected group.
4. Write root state once.
5. Reload Manager collections and clear affected trash selections.

### Batch Permanently Delete Trash Groups

Given selected trash group ids:

1. Read root state once.
2. Validate that each selected id belongs to a trash group.
3. Remove those groups from state.
4. Write root state once.
5. Reload Manager collections and clear affected trash selections.

This operation is not recoverable.

## Code Design

React should not own batch mutation rules. `ManagerApp` should own only UI state and orchestration:

- selection mode state
- selected active ids
- selected trash ids
- confirm prompts
- busy keys
- status messages
- collection reloads

Feature-layer functions should own storage reads, validation, and writes. Candidate additions:

- `batchMoveSessionGroupsToTrash(sessionIds, dependencies)`
- `mergeSessionGroupsIntoDefaultNotesGroup(sessionIds, dependencies)`
- `batchRestoreSessionGroupsFromTrash(sessionIds, dependencies)`
- `batchDeleteSessionGroupsPermanently(sessionIds, dependencies)`

Domain-layer helpers should own pure transformations where useful:

- selecting or creating the default notes group
- appending source tabs to a target group with stable `originalIndex`
- filtering active or trash group ids

The feature functions should accept injectable storage and time dependencies, following the existing feature pattern.

## Error Handling

Batch operations should prefer all-or-nothing writes within one root-state update. They should not loop through single-item feature calls from the UI because partial success would be harder to explain and recover from.

Expected validation errors:

- no selected groups
- source group not found
- source group is in the wrong bucket
- notes merge has no valid source groups after excluding the target
- storage read or write failure

User-facing messages should be short and action-specific, for example:

- `已将 3 个分组移动到回收站。`
- `已将 4 个分组合并入“笔记”。`
- `已恢复 2 个分组。`
- `已永久删除 5 个分组。`

Permanent deletion and notes merge should use stronger confirmation copy because data is removed directly.

## Accessibility

Selection controls should be keyboard reachable and have clear labels:

- group checkbox labels should include the group title
- the toolbar should expose selected count text
- batch buttons should have native button semantics
- disabled actions should be truly disabled, not only visually muted

Selection mode must not make the sidebar impossible to navigate by keyboard. Escape can be considered as a follow-up convenience, but it is not required for the first implementation.

## Testing

Core tests should be added before implementation.

Unit or feature tests:

1. `batchMoveSessionGroupsToTrash` should mark multiple active groups as trashed with one timestamp.
2. `batchMoveSessionGroupsToTrash` should reject trash group ids.
3. `mergeSessionGroupsIntoDefaultNotesGroup` should create `笔记` when missing.
4. `mergeSessionGroupsIntoDefaultNotesGroup` should append source tabs after the target's current tab order.
5. `mergeSessionGroupsIntoDefaultNotesGroup` should remove source groups directly after a successful merge.
6. `mergeSessionGroupsIntoDefaultNotesGroup` should not remove the target `笔记` group when it is included in the selected ids.
7. `batchRestoreSessionGroupsFromTrash` should restore multiple trash groups.
8. `batchDeleteSessionGroupsPermanently` should remove multiple trash groups and reject active group ids.

UI tests should cover the Manager behavior if the existing test setup supports React interaction tests:

1. entering selection mode shows checkboxes and batch toolbar
2. active selections expose active actions
3. trash selections expose trash actions
4. cancel selection clears selected ids

Quality gates:

- `lint`
- `typecheck`
- `test`
- `build`

If the implementation touches a critical user path beyond the Manager sidebar, run `test:e2e` as well.

## Acceptance Criteria

1. A user can select multiple active groups and move them to trash in one action.
2. A user can select multiple active groups and merge them into `笔记` in one action.
3. Missing `笔记` is created automatically during merge.
4. Merged source groups are removed directly from storage after merge.
5. The target `笔记` group is not accidentally removed during merge.
6. A user can select multiple trash groups and restore them in one action.
7. A user can select multiple trash groups and permanently delete them in one action.
8. Existing single-group actions still work.
9. Existing active group drag behavior still works outside selection mode.
10. Tests cover the new batch feature-layer behavior.

## Implementation Notes

Before editing existing functions, run GitNexus impact analysis for each affected symbol as required by `AGENTS.md`.

Because `src/ui/manager/App.tsx` is already large, the implementation should consider extracting small local subcomponents only when it reduces the batch-selection complexity. Any extraction should stay focused on the sidebar tree and batch toolbar, not unrelated Manager layout refactoring.

Storage schema changes are not expected. If implementation discovers a required schema or settings change, pause and add an ADR before proceeding.
