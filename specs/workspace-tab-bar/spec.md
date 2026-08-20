# Workspace Tab Bar Specification

## Overview

This specification defines the behavior of the editor tab bar in Wrangle. As of the unified-sidebar redesign (see `specs/unified-sidebar/spec.md`), the tab bar displays **only the active workspace's tabs** (WTB-014); the earlier multi-workspace tab bar (per-workspace groups, equal space allocation, overflow dropdown) and the WorkspaceBar rail are deprecated.

**Feature Prefix:** `WTB` (Workspace Tab Bar)

---

## Requirements

### WTB-001: Workspace Browse + Show on Single Click

- **Status:** Deprecated
- **Added:** 2026-02-11
- **Updated:** 2026-08-19
- **Source plan:** recouple-show-with-click (deprecated by unified-sidebar-redesign)

**Deprecated.** This requirement defined single-click semantics for the vertical WorkspaceBar rail (browse + show as editor pane, click-active-to-hide). The rail and the multi-pane editor were removed by the unified-sidebar redesign; workspace activation now happens in the unified sidebar (SBR-004) and there is no per-workspace show/hide state (`visibleInTabBar` was removed). The ID is retained and never reused.

---

### WTB-002: Equal Space Allocation Per Workspace

- **Status:** Deprecated
- **Added:** 2026-02-11
- **Updated:** 2026-08-19
- **Source plan:** deprecated by unified-sidebar-redesign

**Deprecated.** Divided the tab bar equally among all visible workspaces. Only one workspace's tabs render at a time now (WTB-014), so there is nothing to allocate between. The ID is retained and never reused.

---

### WTB-003: Independent Horizontal Scrolling Per Workspace

- **Status:** Deprecated
- **Added:** 2026-02-11
- **Updated:** 2026-08-19
- **Source plan:** deprecated by unified-sidebar-redesign

**Deprecated.** Required per-workspace tab groups to scroll independently of one another. With a single rendered group (WTB-014), in-group scrolling is covered by WTB-008/WTB-010. The ID is retained and never reused.

---

### WTB-004: Fixed Workspace Indicator

- **Status:** Deprecated
- **Added:** 2026-02-11
- **Updated:** 2026-08-19
- **Source plan:** deprecated by unified-sidebar-redesign

**Deprecated.** Required a pinned colored indicator at the left edge of each workspace's tab group (`TabGroupHeader`, removed as dead code). Workspace identity is now conveyed by the sidebar's workspace sections (SBR-001); the colored `workspace-toolbar-bar` strip that briefly took this role was removed with the workspace color system (see remove-workspace-colors plan). The ID is retained and never reused.

---

### WTB-005: Active Tab Indicator Uses Workspace Color

- **Status:** Deprecated
- **Added:** 2026-02-11
- **Updated:** 2026-08-19
- **Source plan:** deprecated by remove-workspace-colors (specs/unified-sidebar)

**Deprecated.** Required the active-tab indicator to use the workspace's assigned color. Workspace colors were removed from the UI entirely; the active-tab overline (WTB-011) uses the theme accent color. The `color` field remains in `WorkspaceConfig`/`WorkspaceState` for persistence compatibility (WSP-002 assignment unchanged) but is never rendered. The ID is retained and never reused.

---

### WTB-006: Minimum Workspace Width

- **Status:** Deprecated
- **Added:** 2026-02-11
- **Updated:** 2026-08-19
- **Source plan:** deprecated by unified-sidebar-redesign

**Deprecated.** Guaranteed each visible workspace ≥140px of tab bar width. Only one workspace renders at a time now (WTB-014). The ID is retained and never reused.

---

### WTB-007: Workspace Overflow Dropdown

- **Status:** Deprecated
- **Added:** 2026-02-11
- **Updated:** 2026-08-19
- **Source plan:** deprecated by unified-sidebar-redesign

**Deprecated.** Moved excess workspaces into an overflow dropdown when they could not fit at minimum width. Only one workspace renders at a time now (WTB-014); the `TabBarOverflow` component was removed. The ID is retained and never reused.

---

### WTB-008: Active Tab Auto-Scroll

- **Status:** Active
- **Added:** 2026-02-11
- **Test category:** e2e

When a tab becomes active, the tab group automatically scrolls to ensure the active tab is visible.

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

### WTB-009: Per-Workspace Active Tab Memory

- **Status:** Active
- **Added:** 2026-02-11
- **Updated:** 2026-08-19 (unified-sidebar-redesign: only one workspace renders at a time)
- **Test category:** unit

Each workspace independently tracks its own active tab, and that memory survives workspace switches.

**Behavior:**
- Activating a tab in workspace A does not affect workspace B's remembered active tab
- When switching between workspaces, the editor and tab bar show the target workspace's last-active tab
- (The former "underline on every visible workspace" clause is obsolete — only the active workspace's tabs render, per WTB-014)

**Interface Contract:**
- Redux state: `activeTabIdByWorkspace: Record<WorkspaceId, string | null>` (tabsSlice)
- `TabBar` reads `selectActiveTabIdByWorkspace(state, activeWorkspaceId)`

**Acceptance criteria:**
- `setActiveTab('a2')` for a workspace-A tab leaves `activeTabIdByWorkspace['ws-b']` unchanged
- After `setActiveWorkspace('ws-b')` then `setActiveWorkspace('ws-a')`, `selectActiveTab` resolves to workspace A's last-active tab

---

### WTB-010: Tab Scroll Arrow Buttons

- **Status:** Active
- **Added:** 2026-08-19 (retroactive — behavior predates this entry)
- **Test category:** e2e

When a tab group's tabs overflow horizontally, the native scrollbar is hidden and replaced by hover scroll-arrow buttons at the group's edges.

**Behavior:**
- The native horizontal scrollbar of the tab group is hidden
- A left arrow button appears when scrolled right of the start; a right arrow appears when more tabs exist to the right
- Clicking an arrow scrolls the tab group smoothly by a fixed increment (~200px)
- Arrows update on scroll, resize, and tab add/remove

**Interface Contract:**
- `TabGroup.tsx`: `checkScroll` + `.tab-group-scroll-btn` / `.tab-group-scroll-left` / `.tab-group-scroll-right` (tabs.css)

**E2E Test Plan:**
- Open enough tabs to overflow → right arrow visible, left arrow hidden
- Click right arrow → tabs scroll; left arrow appears
- Scroll fully right → right arrow disappears

---

### WTB-011: Curved Overline Active Tab Indicator

- **Status:** Active
- **Added:** 2026-08-19 (retroactive — behavior predates this entry)
- **Updated:** 2026-08-19 (remove-workspace-colors: accent color instead of workspace color)
- **Test category:** manual

The active tab is indicated by an accent-colored overline that wraps down the tab's sides and flares into concave curves at its base.

**Behavior:**
- Active tab: 2px top/left/right border in `--accent-color`, rounded top corners
- Pseudo-element "flares" at the tab's bottom corners carve concave curves in the accent color
- Inactive tabs have transparent borders reserving the same space (no layout shift on activation)

**Interface Contract:**
- `tabs.css`: `.tab.active`, `.tab.active::before/::after`, `.tab.active .tab-body::before/::after`

**Manual verification:**
1. Open two tabs in a workspace
2. Activate each tab in turn — the accent overline + curved flares follow the active tab with no layout shift

---

### WTB-012: Browse a Workspace Without Adding It to the Editor

- **Status:** Deprecated
- **Added:** 2026-06-23
- **Updated:** 2026-06-24
- **Source plan:** decouple-browse-from-hide (deprecated by recouple-show-with-click)

**Deprecated.** This requirement decoupled browsing from editor membership: a hidden workspace could be browsed (its file tree shown) while staying absent from the editor. Superseded twice — by WTB-001's recoupled model, then by the unified-sidebar redesign which removed show/hide state entirely. The ID is retained and never reused.

---

### WTB-013: Hide Workspace From Editor

- **Status:** Deprecated
- **Added:** 2026-06-23
- **Updated:** 2026-08-19
- **Source plan:** decouple-browse-from-hide (deprecated by unified-sidebar-redesign)

**Deprecated.** Allowed removing a workspace from the editor (`visibleInTabBar = false`) while keeping it open, via an eye-off button and rail click-to-hide. The unified-sidebar redesign removed `visibleInTabBar` and the multi-pane editor; every open workspace is always present in the sidebar, and only the active one shows in the editor (WTB-014). Collapsing a sidebar section (SBR-002) is the closest analogue for reclaiming space. The ID is retained and never reused.

---

### WTB-014: Tab Bar Shows Only the Active Workspace's Tabs

- **Status:** Active
- **Added:** 2026-08-19
- **Source plan:** unified-sidebar-redesign (specs/unified-sidebar)
- **Test category:** unit (selector) + e2e (swap behavior)

The editor tab bar renders exactly one tab group: the active workspace's. Activating a different workspace (clicking one of its files or its section body in the sidebar, cycling with Ctrl+Shift+PageUp/PageDown) swaps the tab bar to that workspace's tabs.

**Behavior:**
- Tabs belonging to non-active workspaces are not rendered (they remain open in state)
- The tab bar renders nothing when the active workspace has no tabs
- Clicking a tab activates it within the (already active) workspace — it never changes the active workspace
- Per-workspace active-tab memory (WTB-009) picks the shown tab after a switch

**Interface Contract:**
- `TabBar.tsx`: memoized selector filtering `tabs` by `activeWorkspaceId`; renders a single `TabGroup`
- `nav.nextWorkspace` / `nav.prevWorkspace` cycle `setActiveWorkspace` over the sidebar order, skipping the default workspace when it has no tabs

**Acceptance criteria:**
- Selector: tabs `[A1(ws-a), B1(ws-b), A2(ws-a)]` with active workspace `ws-a` → `[A1, A2]`
- Selector returns `[]` for a workspace with no tabs
- E2E: with tabs open in two workspaces, clicking a file of the other workspace in the sidebar swaps the visible tab set

---

## Key Files

| File | Purpose |
|------|---------|
| `src/renderer/src/components/Tabs/TabBar.tsx` | Tab bar: single group for the active workspace (WTB-014) |
| `src/renderer/src/components/Tabs/TabGroup.tsx` | Tab container with scrolling (WTB-008/010) |
| `src/renderer/src/components/Tabs/Tab.tsx` | Individual tab |
| `src/renderer/src/components/Tabs/tabs.css` | Tab styling, overline indicator, scroll buttons |
| `src/renderer/src/store/tabsSlice.ts` | Tab state, activeTabIdByWorkspace (WTB-009) |
| `src/renderer/src/store/workspacesSlice.ts` | Workspace state, activeWorkspaceId |

---

## Test Files

Unit tests (vitest): `specs/workspace-tab-bar/tests/wtb-014-active-workspace-tabs.test.ts` (also covers WTB-009 memory).

E2E (Playwright, `e2e/tests/`): WTB-008/010 verified manually or by e2e specs; the deprecated wtb-001/002/003/005/006/007/013 spec files were removed with the redesign and the color removal.
