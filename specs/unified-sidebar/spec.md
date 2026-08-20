# Unified Sidebar Specification

## Overview

The unified sidebar is Wrangle's single left panel combining what were previously two separate strips: the vertical WorkspaceBar rail and the explorer sidebar. It contains the app menu row, a scrollable column of collapsible sections — an optional "Open Files" section for loose tabs, one section per folder workspace, and an "Add Folder" row — and the Outline pane below a draggable split. The multi-workspace-visible-at-once model (multi-pane editor, `visibleInTabBar`, per-pane layout state) was removed in the same redesign; the editor shows the active workspace only (WTB-014 in `specs/workspace-tab-bar/spec.md`).

**Feature Prefix:** `SBR` (SideBaR)

---

## Requirements

### SBR-001: Unified Sidebar Structure

- **Status:** Active
- **Added:** 2026-08-19
- **Source plan:** unified-sidebar-redesign
- **Test category:** e2e

One left sidebar contains, top to bottom: the app menu row (Wrangle/Edit/View), a vertically scrolling column of sections, and the Outline section, with a draggable Allotment split between the column and the Outline. There is no separate workspace rail.

**Behavior:**
- The section column holds: the Open Files section (SBR-003, conditional), one section per folder-backed workspace in store order, then an "+ Add Folder" row (or a prominent "Open Folder" button when there are no folder workspaces and no loose files)
- Sections take their natural height; when they exceed the column, the column scrolls (sections are NOT individually resizable panes)
- Each workspace section header shows: collapse chevron, workspace name (enlarged relative to other sidebar text, normal case — not uppercase), and a hover-visible gear button (SBR-005). Workspace colors are not rendered anywhere (remove-workspace-colors plan); sections are separated by a prominent 2px divider instead
- The active workspace's section is visually marked (accent-colored left border)
- `showExplorer` (Ctrl+Shift+E) toggles the whole section column; `showOutline` (Ctrl+Shift+O) toggles the Outline pane
- The split position persists via `settings.layout.sidebarPaneSizes` (2 panes)

**Interface Contract:**
- `Sidebar.tsx` composes `OpenFilesSection`, `WorkspaceSection` (per workspace), `WorkspaceSettingsPopover`
- CSS: `.sidebar-workspace-column`, `.workspace-section`, `.workspace-section-header` — all interactive children opt out of the sidebar's `app-region: drag`

**E2E Test Plan:**
- Restore a session with 2 folder workspaces + 1 loose tab → sidebar shows Open Files + 2 workspace sections + Add Folder row; no `.workspace-bar` exists
- The active workspace's section carries the `active` class

---

### SBR-002: Independent Persisted Section Collapse

- **Status:** Active
- **Added:** 2026-08-19
- **Source plan:** unified-sidebar-redesign
- **Test category:** unit (reducer) + e2e (persistence)

Every section (each workspace and Open Files) collapses/expands independently by clicking its header. Collapse state persists across app restarts.

**Behavior:**
- Header click toggles that section only — no accordion; any number of sections may be expanded
- A collapsed section renders only its 28px header
- State lives on `WorkspaceState.isExpanded` (the Open Files section uses the `__default__` workspace's flag)
- Persisted in `~/.wrangle/app-session.json`: `expandedWorkspacePaths` (folder workspaces) and `openFilesExpanded`
- A session file without `expandedWorkspacePaths` (pre-redesign) restores with all sections expanded

**Interface Contract:**
- Reducer `toggleWorkspaceExpanded(id)` (workspacesSlice); `setWorkspaceExpanded` used during restore
- Write side: `useSessionPersistence`; restore side: `App.tsx` session restore

**Acceptance criteria:**
- `toggleWorkspaceExpanded('ws-a')` flips only `ws-a.isExpanded`; other workspaces unchanged
- Restore with `expandedWorkspacePaths: [pathB]` → workspace at pathB expanded, others collapsed
- Restore with the field absent → all expanded

---

### SBR-003: Open Files Section

- **Status:** Active
- **Added:** 2026-08-19
- **Source plan:** unified-sidebar-redesign
- **Test category:** e2e

A collapsible "Open Files" section at the top of the column lists the default workspace's tabs (files not belonging to any workspace folder, and unsaved notes).

**Behavior:**
- Rendered only when the default workspace has at least one tab
- Each item shows the file name (or display title for unsaved tabs), its directory (or "Unsaved"), and a dirty dot
- Clicking an item activates the default workspace AND that tab — the tab bar swaps to the loose tabs
- No gear button (the default workspace has no folder config)

**Interface Contract:**
- `OpenFilesSection.tsx` wraps the existing `DefaultWorkspaceFileList`

**E2E Test Plan:**
- With a loose tab open and a folder workspace active, click the loose item → active workspace becomes `__default__`, tab bar shows the loose tab
- Close all loose tabs → the Open Files section disappears

---

### SBR-004: Activation Semantics

- **Status:** Active
- **Added:** 2026-08-19
- **Source plan:** unified-sidebar-redesign
- **Test category:** e2e (interactions) + unit (removeWorkspace fallback)

Which sidebar interactions change the active workspace, and which do not.

**Behavior:**
- Clicking a file in a section's tree opens/focuses the tab and activates that workspace
- Mousedown anywhere in a section's body (folder rows, empty space) activates that workspace without opening a file
- Clicking a section header toggles collapse ONLY — it never activates
- Clicking the gear opens the settings popover ONLY — it never activates or collapses
- Activating a workspace from elsewhere (tab bar, keyboard cycle, OS file open) does not auto-expand a collapsed section
- Closing the active workspace falls back to the nearest remaining folder workspace (previous position), then the default workspace
- Closing a workspace also closes its tabs (`closeTabsByWorkspace` + `cleanupWorkspaceActiveTab`)

**Interface Contract:**
- `WorkspaceSection.tsx` (body `onMouseDown` → `setActiveWorkspace`; header click → `toggleWorkspaceExpanded`; gear `stopPropagation`)
- `removeWorkspace` reducer fallback (workspacesSlice)

**Acceptance criteria (unit):**
- With folder workspaces [A, B, C] and B active, `removeWorkspace(B)` → active = A
- With [A] active, `removeWorkspace(A)` → active = `__default__`
- With [A, B] and A active, `removeWorkspace(A)` → active = B (previous clamps to first)

---

### SBR-005: Workspace Settings Popover

- **Status:** Active
- **Added:** 2026-08-19
- **Updated:** 2026-08-19 (remove-workspace-colors: color control removed)
- **Source plan:** unified-sidebar-redesign
- **Test category:** e2e

A hover-visible gear on each workspace section header opens a small settings popover for that workspace.

**Behavior:**
- Contents, top to bottom: name input (Enter commits, Escape reverts, empty commits the folder basename), "Show hidden files" checkbox, separator, danger-styled "Close Workspace" button (with confirm)
- Name/hidden-files changes apply to Redux immediately and persist to the workspace's `.wrangle/workspace.json`
- Positioned with `position: fixed` anchored below the gear, clamped to the viewport (survives column scrolling/clipping)
- Dismissed by outside mousedown or Escape; at most one popover open at a time

**Interface Contract:**
- `WorkspaceSettingsPopover.tsx` + `hooks/useWorkspaceConfig.ts` (renameWorkspace/toggleHiddenFiles/closeWorkspace)

**E2E Test Plan:**
- Click gear → popover appears; click elsewhere → it closes
- Rename via the input → section header name updates; `.wrangle/workspace.json` contains the new name
- Toggle hidden files → dotfiles appear/disappear in that section's tree
- Close Workspace → section disappears, its tabs close, active falls back per SBR-004

---

## Key Files

| File | Purpose |
|------|---------|
| `src/renderer/src/components/Sidebar/Sidebar.tsx` | Sidebar composition: menus, section column, Outline split |
| `src/renderer/src/components/Sidebar/WorkspaceSection.tsx` | Per-workspace collapsible section (SBR-001/002/004) |
| `src/renderer/src/components/Sidebar/OpenFilesSection.tsx` | Loose-files section (SBR-003) |
| `src/renderer/src/components/Sidebar/WorkspaceSettingsPopover.tsx` | Gear popover (SBR-005) |
| `src/renderer/src/hooks/useWorkspaceConfig.ts` | Rename/hidden-files/close actions with config persistence |
| `src/renderer/src/store/workspacesSlice.ts` | `isExpanded`, `toggleWorkspaceExpanded`, `removeWorkspace` fallback |
| `src/renderer/src/hooks/useSessionPersistence.ts` | Writes `expandedWorkspacePaths` / `openFilesExpanded` |

## Test Files

- Unit: `specs/unified-sidebar/tests/sbr-002-section-collapse.test.ts`, `specs/unified-sidebar/tests/sbr-004-remove-workspace-fallback.test.ts`
- E2E/manual procedures are documented in each requirement's test plan above; live Playwright specs may be added under `e2e/tests/unified-sidebar/`.
