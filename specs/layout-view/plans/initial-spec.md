# Plan: Initial Layout & View Specification (Retroactive)

## Context

Wrangle's layout and view-mode behavior already exists in code (`src/renderer/src/store/layoutSlice.ts`, `src/renderer/src/components/Layout/EditorLayout.tsx`) but has never been captured in a canonical spec. This plan retroactively documents the current behavior as the initial `layout-view` spec so future changes can be tracked against stable requirement IDs.

Feature prefix: `LYT`.

## Proposed Changes

### New Requirements

- **LYT-001: Three View Modes** — `split`, `editor-only`, `preview-only` as mutually exclusive global modes.
- **LYT-002: Split Ratio Clamped to [0.2, 0.8]** — reducer-level clamp on the editor/preview divider.
- **LYT-003: Zoom Level Bounded to [-5, +5] with 1.1^n Scaling** — integer zoom steps with geometric scale factor.
- **LYT-004: Zoom Applies to Editor Font Size and Preview Transform** — editor adjusts font size, preview uses CSS transform.
- **LYT-005: Sidebar and Chrome Toggles** — independent toggles for outline, toolbar, explorer, workspace sidebar.
- **LYT-006: Per-Pane View Mode (paneViewModes)** — per-`WorkspaceId` view mode map for multi-pane layouts.
- **LYT-007: Per-Pane Split Ratio (paneSplitRatios)** — per-`WorkspaceId` split ratio map, same `[0.2, 0.8]` clamp.
- **LYT-008: Focused-Pane Tracking (focusedPaneId)** — tracks which pane receives global layout actions.

### Modified Requirements

None — this is the initial spec.

### Removed Requirements

None.

## Spec Impact

- [x] New requirements added to spec
- [ ] Existing requirements updated in spec
- [ ] Tests created/updated referencing requirement IDs
- [ ] Plan moved to archive

_Because this plan is retroactive documentation of existing behavior, tests do not yet exist and will be added in a follow-up plan. The plan remains in `plans/` until tests are written and the plan is archived._
