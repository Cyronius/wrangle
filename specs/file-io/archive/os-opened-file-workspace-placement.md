# Plan: OS-Opened Files Land in Default Workspace (or Owning Folder) and Take Editor Focus

## Context

When a file is opened via the OS (file association / "Open with" → `file:openFromPath`, per FIO-007/FIO-008), the renderer currently adds the tab to `activeWorkspaceId` — whatever workspace happens to be focused. Two problems:

1. **Wrong placement.** The file should land in the **default workspace**, *unless* one of the currently-open folder-backed workspaces contains the file (its `rootPath` is an ancestor of the file), in which case it lands in that workspace.
2. **No focus.** Even when a tab is added/activated, the active workspace isn't switched and the editor isn't focused, so the file may not be visible or ready to type into.

Current handler: [src/renderer/src/App.tsx:648-673](../../../src/renderer/src/App.tsx). It dispatches `addTab({ workspaceId: activeWorkspaceId, ... })` then `setActiveTab`.

The desired placement rule already exists as `selectWorkspaceForPath` ([src/renderer/src/store/workspacesSlice.ts:179](../../../src/renderer/src/store/workspacesSlice.ts)) — folder-backed match, else default workspace. The handler just doesn't use it. (Note: `detectWorkspaceForPath` in App.tsx is a *different* rule — it falls back to `activeWorkspaceId`, which is correct for the file-picker/tree flows but NOT for OS-opened files.)

The editor pane is driven by `useEditorPane(activeWorkspaceId)`, so making the opened file visible+editable requires switching the active workspace to the target, activating the tab, and focusing Monaco.

## Proposed Changes

### New Requirements

- **FIO-010: OS-Opened File Workspace Placement And Focus** — A file delivered via `file:openFromPath` is placed in the workspace whose `rootPath` is an ancestor of the file path if such an open workspace exists; otherwise it is placed in the default workspace. The target workspace is made active and focused, the file's tab is made active, and the editor receives keyboard focus. If the file is already open, its existing tab is surfaced the same way (workspace activated, tab activated, editor focused) instead of creating a duplicate.

  **Applies to:** wrangle (renderer)
  **Test category:** split — `unit` for the pure placement function; `manual` for the focus/visibility wiring.

### Modified Requirements

- None to FIO-007/FIO-008 behavior; FIO-010 governs the *renderer placement* step that runs after they deliver the event.

## Implementation

1. **Extract a pure placement helper** in `workspacesSlice.ts` so it is reusable and unit-testable:

   ```ts
   // Pure: the folder-backed workspace whose rootPath is an ancestor of filePath, or null.
   // First match wins (matches existing iteration order).
   export function findFolderWorkspaceForPath(
     workspaces: WorkspaceState[],
     filePath: string | undefined
   ): WorkspaceState | null
   ```

   Refactor `selectWorkspaceForPath` to delegate to it: `findFolderWorkspaceForPath(...) ?? selectDefaultWorkspace(state)`. No behavior change to that selector.

2. **Rewrite the `onFileOpenedFromPath` handler** ([App.tsx:648](../../../src/renderer/src/App.tsx)):

   ```ts
   const folderWs = findFolderWorkspaceForPath(workspaces, fileData.path)
   const workspaceId = folderWs ? folderWs.id : DEFAULT_WORKSPACE_ID

   const existingTab = tabs.find(t => t.path === fileData.path)
   const targetTabId = existingTab ? existingTab.id : newTabId
   const targetWorkspaceId = existingTab ? existingTab.workspaceId : workspaceId

   if (!existingTab) dispatch(addTab({ id: newTabId, workspaceId, ... }))
   dispatch(setActiveWorkspace(targetWorkspaceId))
   dispatch(setFocusedPane(targetWorkspaceId))
   dispatch(setActiveTab(targetTabId))
   // focus the editor after the activeTab-driven re-render commits
   requestAnimationFrame(() => editorRef.current?.focus())
   ```

   `setActiveWorkspace` / `setFocusedPane` / `DEFAULT_WORKSPACE_ID` / `editorRef` are already imported/available in App.tsx.

3. Update the effect dependency array (`workspaces` instead of `activeWorkspaceId`).

## Tests

- **unit** (`specs/file-io/tests/fio-010-os-open-placement.test.ts`, Vitest) — `findFolderWorkspaceForPath`:
  - file under a folder workspace's `rootPath` → that workspace
  - file in a subfolder of a folder workspace → that workspace (prefix containment)
  - file not under any folder workspace → `null` (caller substitutes default)
  - no folder-backed workspaces (only default) → `null`
  - Windows backslash vs forward-slash path normalization
  - nested workspaces → first match wins
  Plus a guard test asserting `selectWorkspaceForPath` still returns the default workspace when there's no folder match (refactor parity).

- **manual** (documented in test file, `describe.skip`) — focus/visibility wiring:
  1. With the default workspace and a folder workspace open, double-click a `.md` *outside* the folder → tab opens in Default, Default becomes active, editor is focused.
  2. Double-click a `.md` *inside* the open folder workspace → tab opens in that workspace, it becomes active/focused.
  3. Double-click a file already open in a background workspace → that workspace is surfaced, its tab activated, no duplicate tab.

## Spec Impact

- [ ] FIO-010 added to `specs/file-io/spec.md`
- [ ] `findFolderWorkspaceForPath` extracted; `selectWorkspaceForPath` delegates
- [ ] `onFileOpenedFromPath` handler rewritten
- [ ] unit test added (FIO-010); manual procedure documented
- [ ] Plan archived

## Open Question (resolved by default unless told otherwise)

"The folder that it resides in" is interpreted as **ancestor containment** (file anywhere under a workspace's `rootPath`), consistent with the existing `handleOpen`/tree-open behavior — not strict immediate-parent equality.
