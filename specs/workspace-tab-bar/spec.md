# Workspace Tab Bar Specification

## Overview

This specification defines the behavior of the tab bar when multiple workspaces are open in Wrangle. The tab bar displays open documents grouped by workspace, with intelligent space allocation, independent scrolling per workspace, and graceful handling of overflow scenarios.

**Feature Prefix:** `WTB` (Workspace Tab Bar)

---

## Requirements

### WTB-001: Workspace Visibility Toggle

- **Status:** Active
- **Added:** 2026-02-11

Clicking a workspace in the left sidebar toggles whether that workspace's tabs appear in the tab bar.

**Behavior:**
- When a workspace is "shown": its tab group appears in the tab bar with the workspace indicator and all open tabs
- When a workspace is "hidden": it is completely removed from the tab bar (not collapsed—entirely absent)
- A workspace with no open tabs does not appear in the tab bar regardless of shown/hidden state
- The active workspace is always shown in the tab bar (clicking an inactive workspace makes it active and shows it)
- Users can hide a workspace by clicking it again while it is active, which hides it and activates the next visible workspace

**Interface Contract:**
- Workspace shown/hidden state stored in Redux: `workspacesSlice.visibleInTabBar: Record<WorkspaceId, boolean>`
- Sidebar workspace click handler toggles this state
- TabBar filters workspaces by `visibleInTabBar[id] === true`

**E2E Test Plan:**
- Open 3 workspaces with tabs in each
- Click workspace A in sidebar → verify its tabs appear in tab bar
- Click workspace A again → verify its tabs disappear from tab bar entirely
- Verify workspace B and C remain visible in tab bar

---

### WTB-002: Equal Space Allocation Per Workspace

- **Status:** Active
- **Added:** 2026-02-11

The tab bar's horizontal width is divided equally among all visible workspaces.

**Behavior:**
- If 2 workspaces are visible: each gets 50% of tab bar width
- If 3 workspaces are visible: each gets 33.3% of tab bar width
- If N workspaces are visible: each gets `100% / N` of tab bar width
- This equal division applies regardless of how many tabs each workspace has open
- The minimum width constraint (WTB-006) takes precedence over equal division

**Interface Contract:**
- CSS: `.tab-group { flex: 1 1 0; min-width: var(--tab-group-min-width); }`
- Each workspace's tab group uses `flex: 1` to share space equally

**E2E Test Plan:**
- Open 2 workspaces with tabs
- Measure tab group widths → verify they are equal (within 2px tolerance)
- Open a 3rd workspace
- Measure all 3 tab group widths → verify they are equal
- Add 10 tabs to workspace 1, leave 1 tab in workspace 2
- Verify both workspaces still have equal width allocation

---

### WTB-003: Independent Horizontal Scrolling Per Workspace

- **Status:** Active
- **Added:** 2026-02-11

Each workspace's tab group scrolls horizontally independently when its tabs exceed the allocated width.

**Behavior:**
- When a workspace has more tabs than fit in its allocated width, a horizontal scrollbar appears within that workspace's tab group only
- Scrolling one workspace's tabs does not affect other workspaces
- The scrollbar appears at the bottom of the tab group area
- Scroll position is preserved when switching between workspaces
- The entire tab bar itself does NOT scroll—only individual workspace tab groups scroll

**Interface Contract:**
- CSS: `.tab-group-tabs { overflow-x: auto; overflow-y: hidden; }`
- Tab bar container: `overflow: hidden` (no scrolling at bar level)

**E2E Test Plan:**
- Open 2 workspaces, add 20 tabs to workspace 1, add 2 tabs to workspace 2
- Verify workspace 1 shows a horizontal scrollbar
- Verify workspace 2 does NOT show a scrollbar
- Scroll workspace 1's tabs to the right
- Verify workspace 2's tabs did not move
- Switch to workspace 2 and back to workspace 1
- Verify workspace 1's scroll position was preserved

---

### WTB-004: Fixed Workspace Indicator

- **Status:** Active
- **Added:** 2026-02-11

The workspace's colored indicator bar remains fixed (pinned) at the left edge of its allocated space while tabs scroll.

**Behavior:**
- The workspace indicator (colored vertical bar) is always visible at the leftmost position of the workspace's tab group
- When tabs scroll horizontally, the indicator does not move—tabs scroll beside it
- The indicator serves as a visual anchor identifying which workspace owns the scrolling tabs
- Clicking the indicator should focus/activate that workspace

**Interface Contract:**
- TabGroupHeader positioned with `position: sticky; left: 0; z-index: 1`
- Or: TabGroupHeader outside the scrollable container, tabs in a separate scrollable div

**E2E Test Plan:**
- Open a workspace with 15+ tabs (enough to scroll)
- Scroll the tabs fully to the right
- Verify the colored workspace indicator is still visible at the left edge
- Click the indicator → verify the workspace becomes active

---

### WTB-005: Active Tab Indicator Uses Workspace Color

- **Status:** Active
- **Added:** 2026-02-11

The underline indicator for the active tab within a workspace matches that workspace's assigned color, not the global accent color.

**Behavior:**
- Each workspace has an assigned color (used for its sidebar indicator and tab group header)
- The active tab's bottom border uses this same workspace color
- This allows users to quickly identify which workspace a tab belongs to even when many tabs are visible
- The indicator remains 3px solid bottom border (same style, different color source)

**Interface Contract:**
- Tab component receives `workspaceColor` prop
- CSS: `.tab.active { border-bottom-color: var(--workspace-color); }`
- Or: inline style applied based on workspace color

**E2E Test Plan:**
- Open 2 workspaces with different colors (e.g., blue and green)
- Open tabs in both workspaces
- Activate a tab in the blue workspace → verify its underline is blue
- Activate a tab in the green workspace → verify its underline is green
- Verify the colors match the workspace indicator colors exactly

---

### WTB-006: Minimum Workspace Width

- **Status:** Active
- **Added:** 2026-02-11

Each visible workspace in the tab bar has a minimum width that ensures usability.

**Behavior:**
- Minimum width must accommodate: workspace indicator (16px) + at least the active tab (min 100px) + padding
- Suggested minimum: 140px per workspace
- When equal division (WTB-002) would result in widths below the minimum, workspaces use their minimum width instead
- If total minimum widths exceed tab bar width, the overflow behavior (WTB-007) activates

**Interface Contract:**
- CSS variable: `--tab-group-min-width: 140px`
- Flex item: `min-width: var(--tab-group-min-width)`

**E2E Test Plan:**
- Open 10 workspaces with tabs
- Verify no workspace is narrower than 140px
- Resize window to be very narrow
- Verify workspaces maintain minimum width until overflow triggers

---

### WTB-007: Workspace Overflow Dropdown

- **Status:** Active
- **Added:** 2026-02-11

When too many workspaces are visible to fit at their minimum widths, excess workspaces move to an overflow dropdown menu.

**Behavior:**
- Calculate how many workspaces fit: `floor(tabBarWidth / minWorkspaceWidth)`
- If visible workspaces exceed this count, show an overflow indicator at the right edge of the tab bar
- The overflow indicator shows a count of hidden workspaces (e.g., "+3")
- Clicking the overflow indicator opens a dropdown listing the hidden workspaces by name and color
- Clicking a workspace in the dropdown activates it and brings it into the visible area (may push another workspace to overflow)
- The currently active workspace should always be visible in the tab bar, never in overflow
- Priority for visible slots: active workspace first, then most recently used

**Interface Contract:**
- New component: `TabBarOverflow` rendered at right edge of tab bar when overflow occurs
- Dropdown contains: workspace name, color indicator, tab count for each hidden workspace
- Redux selector: `selectOverflowWorkspaces` returns workspaces that don't fit

**E2E Test Plan:**
- Resize window to be narrow (e.g., 400px wide)
- Open 5 workspaces with tabs
- Verify overflow indicator appears showing hidden count
- Click the overflow indicator → verify dropdown opens with hidden workspace names
- Click a workspace in dropdown → verify it appears in tab bar and another moves to overflow
- Verify the active workspace never appears in the overflow dropdown

---

### WTB-008: Active Tab Auto-Scroll

- **Status:** Active
- **Added:** 2026-02-11

When a tab becomes active, its workspace's tab group automatically scrolls to ensure the active tab is visible.

**Behavior:**
- When user clicks a tab (already visible), no scroll adjustment needed
- When user activates a tab via keyboard shortcut, file open, or other means, scroll the tab into view
- When switching to a workspace whose active tab is scrolled offscreen, scroll to reveal it
- Use smooth scrolling animation (not instant jump)
- The active tab should be fully visible, not partially cut off at edges

**Interface Contract:**
- Use `Element.scrollIntoView({ behavior: 'smooth', inline: 'nearest' })` or equivalent
- Trigger scroll on: tab activation, workspace switch, new tab creation

**E2E Test Plan:**
- Open a workspace with 20 tabs
- Scroll tabs to the far right manually
- Use keyboard shortcut to activate the first tab
- Verify tab group smoothly scrolls to show the first tab
- Switch to another workspace and back
- Verify the active tab is visible without manual scrolling

---

### WTB-009: Multiple Active Tabs (One Per Workspace)

- **Status:** Active
- **Added:** 2026-02-11

Each workspace independently tracks its own active tab.

**Behavior:**
- Activating a tab in workspace A does not affect workspace B's active tab
- When switching between workspaces, each workspace shows its last-active tab in the editor
- The visual active indicator (underline) shows on the active tab of EVERY visible workspace, not just the currently focused workspace
- This allows users to see at a glance which document was last viewed in each workspace

**Interface Contract:**
- Redux state: `activeTabIdByWorkspace: Record<WorkspaceId, string | null>`
- TabBar renders active styling for each workspace's active tab independently
- Editor displays the active tab of the currently active workspace

**E2E Test Plan:**
- Open workspace A with tabs doc1, doc2, doc3 - activate doc2
- Open workspace B with tabs file1, file2 - activate file2
- Verify both doc2 AND file2 show active underlines simultaneously
- Switch to workspace A → verify editor shows doc2
- Switch to workspace B → verify editor shows file2
- Verify doc2 still shows active underline in workspace A's tab group

---

## Key Files

| File | Purpose |
|------|---------|
| `src/renderer/src/components/Tabs/TabBar.tsx` | Main tab bar container, workspace filtering, overflow detection |
| `src/renderer/src/components/Tabs/TabGroup.tsx` | Individual workspace's tab container with independent scrolling |
| `src/renderer/src/components/Tabs/TabGroupHeader.tsx` | Fixed workspace indicator (colored bar) |
| `src/renderer/src/components/Tabs/Tab.tsx` | Individual tab with workspace-colored active indicator |
| `src/renderer/src/components/Tabs/TabBarOverflow.tsx` | Overflow dropdown for hidden workspaces (new) |
| `src/renderer/src/components/Tabs/tabs.css` | Styling for equal width, scrolling, minimum widths |
| `src/renderer/src/store/tabsSlice.ts` | Tab state, activeTabIdByWorkspace |
| `src/renderer/src/store/workspacesSlice.ts` | Workspace state, visibleInTabBar |

---

## E2E Test File Structure

```
tests/e2e/workspace-tab-bar/
├── wtb-001-visibility-toggle.spec.ts
├── wtb-002-equal-space.spec.ts
├── wtb-003-independent-scroll.spec.ts
├── wtb-004-fixed-indicator.spec.ts
├── wtb-005-workspace-color-indicator.spec.ts
├── wtb-006-minimum-width.spec.ts
├── wtb-007-overflow-dropdown.spec.ts
├── wtb-008-auto-scroll.spec.ts
└── wtb-009-multiple-active-tabs.spec.ts
```

Each test file tests its corresponding requirement using the test plans defined above.
