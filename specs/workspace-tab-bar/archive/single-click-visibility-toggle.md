# Plan: Single-click workspace toggles visibility

## Context

Hiding a visible-but-inactive workspace currently takes two clicks: the first click only
activates it, the second hides it. This is awkward when two workspaces are open in a
multi-pane split and the user wants to collapse to just one. The desired behavior is a
single click that toggles a workspace's visibility regardless of whether it is active.

## Proposed Changes

### Modified Requirements

- **WTB-001: Workspace Visibility Toggle** — Change the click semantics so a single click
  on a workspace in the WorkspaceBar toggles its `visibleInTabBar` state:
  - Click a visible workspace → hide it (unless it is the only visible workspace, which is a
    no-op so the editor is never left empty).
  - Hiding the active workspace activates the next remaining visible workspace.
  - Click a hidden workspace → show it and make it active.

  This replaces the prior rule that "clicking an inactive workspace makes it active and shows
  it" and that a workspace is hidden "by clicking it again while it is active."

## Spec Impact

- [x] Existing requirement updated in spec (WTB-001 behavior + E2E test plan)
- [ ] New requirements added — none
- [ ] Tests created/updated — WTB-001 is E2E/manual; no executable test exists
- [x] Plan moved to archive

Tradeoff: single-clicking a visible-but-unfocused workspace now hides it rather than
focusing it. Focus between two visible panes is changed by clicking inside the pane.
