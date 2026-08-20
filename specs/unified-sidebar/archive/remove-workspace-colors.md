# Plan: Remove Workspace Colors From the UI

## Context

With the unified sidebar, workspace identity is carried by the named, collapsible sections — the color system (rail colors, colored tab overline, colored toolbar stripe, color dot, color picker) is no longer load-bearing. Remove all color rendering; compensate with a more prominent section divider and a slightly larger, normal-case (not uppercase) section name. The `color` field remains in `WorkspaceState`/`WorkspaceConfig` and WSP-002 assignment is untouched (persisted config stays backward/forward compatible); it is simply no longer rendered or user-editable.

## Proposed Changes

### Modified Requirements
- **SBR-001** — Section header loses the color dot; the section divider becomes more prominent; the section name is larger and normal-case. Active-section cue uses the accent color instead of the workspace color.
- **SBR-005** — Settings popover loses the color control (now: rename, hidden files, close).
- **WTB-011** — The active-tab overline uses the theme accent color instead of the workspace color.

### Removed Requirements
- **WTB-005** (Active Tab Indicator Uses Workspace Color) — deprecated; there is no per-workspace color in the UI.
- The `workspace-toolbar-bar` colored stripe under the tab bar (was part of WTB-004's deprecation note; no ID of its own) is removed outright.

## Spec Impact
- [x] Existing requirements updated in spec (SBR-001, SBR-005, WTB-011; WTB-005 deprecated)
- [x] Tests updated (wtb-005 e2e deleted; wtb-014/SBR unit tests unaffected)
- [x] Plan moved to archive
