# Plan: Initial Tabs Spec (Retroactive)

## Context

The tab model and lifecycle behavior has been implemented in `src/renderer/src/store/tabsSlice.ts` for some time, but no canonical specification existed. This plan retroactively captures the current, intended behavior as requirements under the new `TAB` feature prefix, so future changes are grounded in a spec rather than in code archaeology.

Scope is intentionally limited to tab state/lifecycle. Tab-bar visual layout (WTB) and file I/O (FIO) are separate features with their own specs.

## Proposed Changes

### New Requirements

- **TAB-001: Add Tab and Auto-Activate** — `addTab` appends a tab and sets it active for its workspace; idempotent for duplicate IDs (session restore).
- **TAB-002: Dedupe by File Path on Open** — opening an already-open file path activates the existing tab instead of creating a duplicate.
- **TAB-003: Close Tab and Auto-Select Next** — `closeTab` removes a tab and auto-selects another in the same workspace (or `null` if none).
- **TAB-004: Dirty State Tracking** — `isDirty` set on content change and cleared on save via `updateTab`.
- **TAB-005: Reorder Tabs Within Workspace** — `reorderTabs` accepts workspace-relative indices and never crosses workspaces.
- **TAB-006: Tab Context Menu Close Variants** — Close / Close Others / Close Left / Close Right, all workspace-scoped.
- **TAB-007: Cursor Position Persistence Per Tab** — `updateTabPosition` persists caret position; restored on activation.
- **TAB-008: Scroll Position Persistence Per Tab** — `updateTabScroll` persists `scrollTop`; restored on activation.
- **TAB-009: Per-Workspace Active Tab Map** — `activeTabIdByWorkspace` keyed by workspace with init/cleanup reducers.
- **TAB-010: Next/Previous Tab Navigation** — `nextTab` / `previousTab` within the current workspace, wrapping at ends.
- **TAB-011: Move Tab to Another Workspace** — `moveTabToWorkspace` reassigns `workspaceId` and updates active-tab bookkeeping in both workspaces.
- **TAB-012: Close All Tabs in a Workspace** — `closeTabsByWorkspace` on workspace close.

### Modified Requirements

- None (initial spec).

### Removed Requirements

- None (initial spec).

## Spec Impact

- [x] New requirements added to spec
- [ ] Existing requirements updated in spec
- [ ] Tests created/updated referencing requirement IDs
- [ ] Plan moved to archive

_Note: tests are not yet in place for these requirements. Adding test coverage that references `TAB-001` through `TAB-012` is a follow-up task tracked separately. This plan should not be archived until tests exist (or each requirement is explicitly reclassified as `manual`/`e2e` with documented verification)._
