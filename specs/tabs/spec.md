# Tabs Specification

## Overview

This specification defines the tab model and lifecycle within the Wrangle renderer: how tabs are created, activated, closed, reordered, navigated, persisted (cursor/scroll), and moved between workspaces. Each tab represents an open document (saved or unsaved) scoped to a single workspace.

**Feature Prefix:** `TAB`

**Scope:** Tab state and reducer behavior in `tabsSlice.ts`, plus renderer interactions that invoke those reducers (context menus, keyboard navigation).

**Out of scope:**
- Tab bar visual layout, workspace grouping, overflow, and scrolling — see `WTB` (Workspace Tab Bar).
- File read/write, dialog, and disk operations — see `FIO` (File I/O).

---

## Requirements

### TAB-001: Add Tab and Auto-Activate

- **Status:** Active
- **Added:** 2026-04-23

Adding a tab via `addTab` appends it to the global tabs array and makes it the active tab for its workspace. The operation is idempotent when a tab with the same ID already exists (required for session restore replay).

**Behavior:**
- New tab is appended to `state.tabs`.
- `activeTabIdByWorkspace[tab.workspaceId]` is set to the new tab's ID.
- If a tab with the same `id` already exists, the action is a no-op (no duplicate inserted, no active-tab change).

**Interface Contract:**
- Reducer: `addTab(tab: TabDocument)`.
- `TabDocument` includes `id`, `workspaceId`, optional `path`, `filename`, `content`, `isDirty`, optional `displayTitle`, optional `cursorPosition`, optional `scrollTop`.

---

### TAB-002: Dedupe by File Path on Open

- **Status:** Active
- **Added:** 2026-04-23

Opening a file whose path is already open in any tab must activate the existing tab rather than creating a duplicate.

**Behavior:**
- Before calling `addTab` for a file-backed open, callers use `selectTabByPath(state, filePath)` to find an existing tab.
- If found, dispatch `setActiveTab(existingTab.id)` instead of creating a new tab.
- Dedupe is global across workspaces (one path = one tab, in whichever workspace it currently lives).

**Interface Contract:**
- Selector: `selectTabByPath(state, filePath): TabDocument | undefined`.
- Open-file flow uses this selector before dispatching `addTab`.

---

### TAB-003: Close Tab and Auto-Select Next

- **Status:** Active
- **Added:** 2026-04-23

Closing a tab removes it from state. If the closed tab was the active tab for its workspace, another tab from the same workspace is auto-selected; if none remain, the workspace's active tab becomes `null`.

**Behavior:**
- `closeTab(tabId)` removes the tab from `state.tabs`.
- If the closed tab was `activeTabIdByWorkspace[workspaceId]`, select the first remaining tab in the same workspace (order-preserving).
- If no tabs remain in that workspace, set `activeTabIdByWorkspace[workspaceId] = null`.
- Closing a tab never changes active tabs in other workspaces.

**Interface Contract:**
- Reducer: `closeTab(tabId: string)`.

---

### TAB-004: Dirty State Tracking

- **Status:** Active
- **Added:** 2026-04-23

A tab's `isDirty` flag reflects whether its in-memory content has unsaved changes. It is set when content diverges from the last-saved state and cleared when the file is saved.

**Behavior:**
- When the editor updates tab content, `updateTab({ id, content, isDirty: true })` is dispatched.
- On successful save, `updateTab({ id, isDirty: false })` is dispatched.
- New unsaved tabs start with `isDirty: true` or `false` at the caller's discretion (typically `false` for empty scratch tabs, `true` once typed into).
- Dirty state is per-tab and independent of workspace activity.

**Interface Contract:**
- Reducer: `updateTab(partial: Partial<TabDocument> & { id: string })`.

---

### TAB-005: Reorder Tabs Within Workspace

- **Status:** Active
- **Added:** 2026-04-23

Tabs can be reordered by drag-and-drop, but only within their own workspace. Indices provided to the reducer are workspace-relative, not global.

**Behavior:**
- `reorderTabs({ workspaceId, oldIndex, newIndex })` moves the tab at workspace-relative `oldIndex` to workspace-relative `newIndex`.
- Tabs from other workspaces are not touched, and their relative order in the global `tabs` array is preserved.
- No-op when `oldIndex === newIndex` or either index is out of range for that workspace.
- Reordering does not change active-tab assignments.

**Interface Contract:**
- Reducer: `reorderTabs({ workspaceId: WorkspaceId, oldIndex: number, newIndex: number })`.

---

### TAB-006: Tab Context Menu Close Variants

- **Status:** Active
- **Added:** 2026-04-23

The per-tab context menu exposes four close operations: Close, Close Others, Close to the Left, Close to the Right. All scope-limited operations are workspace-local.

**Behavior:**
- **Close**: `closeTab(tabId)` — see TAB-003.
- **Close to the Left**: `closeTabsToLeft(tabId)` removes all tabs preceding the target within the same workspace. If the workspace's active tab was among those removed, the target tab becomes active.
- **Close to the Right**: `closeTabsToRight(tabId)` removes all tabs following the target within the same workspace. If the workspace's active tab was among those removed, the target tab becomes active.
- **Close Others**: equivalent to dispatching `closeTabsToLeft(tabId)` followed by `closeTabsToRight(tabId)` (or a single composite reducer with the same effect). The target tab remains and becomes active in its workspace.
- None of these variants affect tabs in other workspaces.

**Interface Contract:**
- Reducers: `closeTabsToLeft(tabId: string)`, `closeTabsToRight(tabId: string)`.
- "Close Others" is implemented at the dispatch/handler layer by composing the two directional reducers.

---

### TAB-007: Cursor Position Persistence Per Tab

- **Status:** Active
- **Added:** 2026-04-23

Each tab remembers its last-known editor cursor position. When a tab is re-activated, the editor restores the cursor to that position.

**Behavior:**
- Editor updates dispatch `updateTabPosition({ id, cursorPosition })` as the user moves the caret (debounced is acceptable).
- On tab activation, the editor reads `tab.cursorPosition` and sets the Monaco caret to that `{ lineNumber, column }`.
- If `cursorPosition` is undefined (fresh tab), the editor uses Monaco's default (typically line 1, column 1).
- Cursor position survives session restore (persisted alongside the tab).

**Interface Contract:**
- Reducer: `updateTabPosition({ id: string, cursorPosition: { lineNumber: number; column: number } })`.
- `TabDocument.cursorPosition?: { lineNumber: number; column: number }`.

---

### TAB-008: Scroll Position Persistence Per Tab

- **Status:** Active
- **Added:** 2026-04-23

Each tab remembers its last-known editor vertical scroll offset and restores it on re-activation, independent of cursor position.

**Behavior:**
- Editor dispatches `updateTabScroll({ id, scrollTop })` when the user scrolls (debounced is acceptable).
- On tab activation, the editor restores `tab.scrollTop` via Monaco's scroll API.
- If `scrollTop` is undefined, no restore is performed (natural default: top).
- Scroll position survives session restore.

**Interface Contract:**
- Reducer: `updateTabScroll({ id: string, scrollTop: number })`.
- `TabDocument.scrollTop?: number`.

---

### TAB-009: Per-Workspace Active Tab Map

- **Status:** Active
- **Added:** 2026-04-23

Active-tab tracking is keyed by workspace, so each workspace independently remembers its own active tab.

**Behavior:**
- State holds `activeTabIdByWorkspace: Record<WorkspaceId, string | null>`.
- `setActiveTab(tabId)` updates only the entry for the target tab's workspace.
- `initWorkspaceActiveTab(workspaceId)` ensures an entry exists (initialized to `null`) when a new workspace is created.
- `cleanupWorkspaceActiveTab(workspaceId)` removes the entry when a workspace is destroyed.
- Selectors: `selectActiveTabIdByWorkspace`, `selectActiveTabByWorkspace`, and `selectActiveTabId` (for the currently focused workspace).

**Interface Contract:**
- Reducers: `setActiveTab(tabId)`, `initWorkspaceActiveTab(workspaceId)`, `cleanupWorkspaceActiveTab(workspaceId)`.

---

### TAB-010: Next/Previous Tab Navigation

- **Status:** Active
- **Added:** 2026-04-23

Keyboard shortcuts (or menu items) navigate between tabs within the currently focused workspace, wrapping at the ends.

**Behavior:**
- `nextTab(workspaceId)` activates the tab immediately after the current active tab in workspace order; from the last tab, wraps to the first.
- `previousTab(workspaceId)` activates the tab immediately before; from the first tab, wraps to the last.
- Both are no-ops when the workspace has zero or one tab.
- Navigation is scoped to the workspace passed in; other workspaces' active tabs are unchanged.

**Interface Contract:**
- Reducers: `nextTab(workspaceId: WorkspaceId)`, `previousTab(workspaceId: WorkspaceId)`.

---

### TAB-011: Move Tab to Another Workspace

- **Status:** Active
- **Added:** 2026-04-23

A tab can be reassigned from one workspace to another (e.g. via drag-and-drop across workspace groups or a context-menu action).

**Behavior:**
- `moveTabToWorkspace({ tabId, newWorkspaceId })` updates the tab's `workspaceId`.
- If the tab was the active tab in its previous workspace, the previous workspace auto-selects the next remaining tab (or `null` if none remain).
- The tab becomes the active tab in its new workspace.
- The tab's position in the global `tabs` array may change, but its content, dirty state, cursor position, and scroll position are preserved.

**Interface Contract:**
- Reducer: `moveTabToWorkspace({ tabId: string, newWorkspaceId: WorkspaceId })`.

---

### TAB-012: Close All Tabs in a Workspace

- **Status:** Active
- **Added:** 2026-04-23

When a workspace is closed, all of its tabs are removed in a single operation, and its active-tab entry is cleared.

**Behavior:**
- `closeTabsByWorkspace(workspaceId)` removes every tab whose `workspaceId` matches.
- `activeTabIdByWorkspace[workspaceId]` is set to `null` (the entry itself may be removed separately via `cleanupWorkspaceActiveTab`).
- Tabs in other workspaces are not affected.
- Dirty-state prompting (confirm discard) is a caller-layer concern; the reducer itself unconditionally closes the tabs.

**Interface Contract:**
- Reducer: `closeTabsByWorkspace(workspaceId: WorkspaceId)`.

---

## Key Files

| File | Purpose |
|------|---------|
| `src/renderer/src/store/tabsSlice.ts` | Tab state, reducers, selectors |
| `src/renderer/src/components/Tabs/Tab.tsx` | Tab component, context menu trigger |
| `src/renderer/src/components/Tabs/TabBar.tsx` | Hosts per-workspace tab groups, drag-reorder handlers |
| `src/shared/workspace-types.ts` | `WorkspaceId`, `DEFAULT_WORKSPACE_ID` |
