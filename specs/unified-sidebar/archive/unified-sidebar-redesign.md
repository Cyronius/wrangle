# Plan: Unified Workspace Sidebar Redesign

## Context

The current UI has two separate left-edge strips: a 36px vertical `WorkspaceBar` rail (workspace show/hide, multi-pane control) and the `Sidebar` (active workspace's explorer + outline). Multiple workspaces can be visible at once, driving a multi-pane editor with per-pane layout state. This is being replaced with a single unified sidebar: every workspace is an independently collapsible section containing its file tree; loose files appear in an "Open Files" section; per-workspace controls live in a gear-triggered settings popover; the editor tab bar shows only the active workspace's tabs. All multi-workspace-visible-at-once machinery is removed.

## Proposed Changes

### New Requirements

- **SBR-001: Unified sidebar structure** — One left sidebar containing: the app menu row, a scrollable column of sections (conditional "Open Files" section, one section per folder workspace, an "Add Folder" row), and the Outline pane below an Allotment split. The separate WorkspaceBar rail is removed.
- **SBR-002: Independent persisted section collapse** — Each workspace section (including Open Files) collapses/expands independently via header click. State persists in `app-session.json` (`expandedWorkspacePaths`, `openFilesExpanded`); absent fields → all expanded.
- **SBR-003: Open Files section** — Lists default-workspace tabs (name, directory, dirty dot). Hidden when the default workspace has no tabs. Item click activates the tab and the default workspace.
- **SBR-004: Activation semantics** — Clicking a file or a section's body activates that workspace (tab bar swaps); clicking a section header only toggles collapse; the gear never activates or collapses.
- **SBR-005: Workspace settings popover** — Hover-visible gear on the section header opens a popover with rename, color palette + custom color, hidden-files toggle, and Close Workspace. Config edits persist to `.wrangle/workspace.json`. Dismiss on outside click or Escape.
- **WTB-014: Active-workspace tab bar** (in `specs/workspace-tab-bar/spec.md`) — The tab bar renders only the active workspace's tabs. Per-workspace active-tab memory (`activeTabIdByWorkspace`) is retained across switches.

### Modified Requirements

- **WTB-009** — Keep per-workspace active-tab tracking; drop "underline on every visible workspace" wording (only one workspace renders at a time).
- **WSP-006** — AppSession gains `expandedWorkspacePaths?`/`openFilesExpanded?`; `visibleWorkspacePaths` and `focusedPaneWorkspacePath` join the deprecated-ignored list.
- **LYT-005** — Chrome toggles reduce to `showOutline`/`showToolbar`/`showExplorer` (`showWorkspaceSidebar` removed; `showExplorer` now toggles the whole workspace column).

### Removed Requirements (deprecated, IDs retained)

- **WTB-001** (rail click semantics), **WTB-002/003/006/007** (multi-pane equal space / independent scroll / min width / overflow dropdown), **WTB-013** (hide workspace from editor) — the rail and multi-pane visibility model no longer exist. (WTB-003's per-group scroll survives implicitly via WTB-010 in the single group.)
- **LYT-006/007/008** (per-pane view mode, split ratio, focused pane) — multi-pane editor removed.

### Spec hygiene

- **WTB-010** (tab scroll arrows) and **WTB-011** (curved overline indicator) are referenced in code/tests but missing from `spec.md` — add entries; both survive this redesign.

## Spec Impact

- [x] New requirements added to spec (`specs/unified-sidebar/spec.md`, WTB-014 in workspace-tab-bar)
- [x] Existing requirements updated in spec (WTB-009, WSP-006, LYT-005; deprecations flagged)
- [x] Tests created/updated referencing requirement IDs (unit: reducers + tab selector; e2e/manual: sidebar structure, collapse, popover, activation)
- [x] Plan moved to archive
