# Plan: Decouple Workspace Browse from Hide

## Context

The WorkspaceBar rail overloaded a single click onto toggling `visibleInTabBar` (WTB-001). The sidebar file explorer only shows the active/expanded workspace, so there was no way to browse a visible workspace's files without yanking it out of the editor. This plan separates two independent concepts:

- **Browse** — which workspace's file tree shows in the explorer (driven by single click, non-destructive).
- **In editor** (`visibleInTabBar`) — whether a workspace's pane occupies editor space (changed only by an explicit hide affordance; re-shown by opening a file).

## Proposed Changes

### Modified Requirements
- **WTB-001: Workspace Browse on Single Click** — A single click on a rail workspace browses it (activate + expand + show sidebar + focus); it no longer toggles `visibleInTabBar`.

### New Requirements
- **WTB-012: Browse a Workspace Without Adding It to the Editor** — Browsing a hidden (browse-only) workspace shows its file tree while it remains absent from the editor; the sidebar reads the active workspace independent of `visibleInTabBar`.
- **WTB-013: Hide Workspace From Editor** — A dedicated eye-off (not ×) hide affordance, on hover on the rail item and as a button in the sidebar workspace header, sets `visibleInTabBar=false` while leaving the workspace open and browsable. No-op when it is the only visible workspace. Hiding does not change the active/browsed workspace; editor focus falls back to another visible pane. Opening any file from a hidden workspace re-shows it. The rail item is dimmed (`not-in-editor`) when hidden.

## Spec Impact
- [ ] WTB-001 updated in spec.md
- [ ] WTB-012, WTB-013 added to spec.md
- [ ] E2E tests created/updated referencing IDs (wtb-001 rewrite, new wtb-012/013)
- [ ] Plan moved to archive
