# Plan: Re-couple "show in editor" with rail click

## Context

The "decouple-browse-from-hide" change made a single click on a rail workspace browse-only — it set
the active workspace and expanded its file tree but never set `visibleInTabBar = true`. In practice
this meant a workspace could only be shown in the editor by being freshly added or by opening a file
from it, so users could effectively only see one workspace at a time, and the hide affordance was a
silent no-op (its last-visible guard always fired because only one workspace was ever visible).

Per product decision, clicking a workspace should browse it **and** show it as an editor pane, so
panes build up side-by-side and the eye-off hide affordance becomes meaningful.

## Proposed Changes

### Modified Requirements
- **WTB-001: Workspace Browse + Show on Single Click** — A single click now dispatches
  `setVisibleInTabBar({ visible: true })` in addition to the browse/activation actions. Clicking a
  hidden workspace re-shows it as a pane; clicking an already-visible workspace is idempotent.

### Removed Requirements
- **WTB-012: Browse a Workspace Without Adding It to the Editor** — Deprecated. The new WTB-001
  always adds the clicked workspace to the editor, so "browse without showing" no longer exists.

### Modified Requirements (clarification)
- **WTB-013: Hide Workspace From Editor** — Unchanged hide behavior and last-visible no-op guard.
  Clarify that clicking a hidden workspace in the rail re-shows it (in addition to the existing
  file-open re-show triggers), and that browse-only state is now transient (cleared on next click).

## Follow-up refinement (2026-06-25)

After review, the hide UX was reworked so there are exactly two hide affordances:
- **Removed** the eye-off button from the narrow workspace rail (`.workspace-bar-hide-btn` in
  WorkspaceBar.tsx) — the rail items carry no hide button now (the `not-in-editor` dimming stays).
- **Kept** the eye-off hide button in the explorer (Sidebar) workspace header
  (`.sidebar-workspace-hide`), next to the × close button, disabled when last-visible.
- **Added** a rail click-to-hide toggle: clicking the *already-active, visible* workspace in the
  rail hides it (`handleWorkspaceClick` delegates to `handleHideWorkspace`, last-visible guard still
  applies). Clicking it again re-shows it.
- WTB-001 and WTB-013 updated accordingly; `hideWorkspaceFromHeader` test helper now activates the
  workspace then clicks the explorer hide button; the rail-button helper was removed.

## Spec Impact
- [x] Existing requirements updated in spec (WTB-001, WTB-013)
- [x] Requirement deprecated in spec (WTB-012)
- [x] Tests created/updated referencing requirement IDs
- [x] Plan moved to archive
