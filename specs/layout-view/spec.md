# Layout & View Specification

## Overview

This specification defines Wrangle's editor layout and view-mode behavior: how the editor and preview panes are arranged, how users switch between view modes, how zoom works, how auxiliary UI chrome (outline, toolbar, explorer, workspace sidebar) is toggled, and how multi-pane workspaces track per-pane layout state.

**Feature Prefix:** `LYT` (Layout & View)

---

## Requirements

### LYT-001: Three View Modes

- **Status:** Active
- **Added:** 2026-04-23

The application supports exactly three mutually exclusive top-level view modes: `split`, `editor-only`, and `preview-only`.

**Behavior:**
- `split` shows the Monaco editor and the Markdown preview side-by-side, separated by a draggable divider
- `editor-only` shows only the Monaco editor, occupying the full content area
- `preview-only` shows only the rendered Markdown preview, occupying the full content area
- Switching view modes does not lose unsaved content; editor state is preserved across mode changes
- The view mode is global (applies to the focused pane / active workspace) and is persisted in Redux

**Interface Contract:**
- Type: `ViewMode = 'split' | 'editor-only' | 'preview-only'`
- Redux state: `layout.viewMode: ViewMode`
- Action: `setViewMode(mode: ViewMode)`
- Default: `'split'`

---

### LYT-002: Split Ratio Clamped to [0.2, 0.8]

- **Status:** Active
- **Added:** 2026-04-23

The split-pane divider ratio between editor and preview is clamped to the inclusive range `[0.2, 0.8]`.

**Behavior:**
- A value of `0.5` gives equal width to editor and preview
- Values below `0.2` are coerced to `0.2`; values above `0.8` are coerced to `0.8`
- Clamping occurs inside the reducer so no caller can bypass it

**Interface Contract:**
- Redux state: `layout.splitRatio: number` (default `0.5`)
- Action: `setSplitRatio(ratio: number)` applies `Math.max(0.2, Math.min(0.8, ratio))`

---

### LYT-003: Zoom Level Bounded to [-5, +5] with 1.1^n Scaling

- **Status:** Active
- **Added:** 2026-04-23

Zoom is represented as an integer step in the inclusive range `[-5, +5]`, where the effective scale factor is `1.1^zoomLevel`.

**Behavior:**
- `zoomLevel = 0` means 100% (no scaling)
- `zoomIn` increments `zoomLevel` by 1, capped at `+5`
- `zoomOut` decrements `zoomLevel` by 1, floored at `-5`
- `resetZoom` sets `zoomLevel` back to `0`
- Step size of `1.1` gives approximately 10% change per step (e.g., `+1 ≈ 110%`, `-1 ≈ 90.9%`, `+5 ≈ 161%`)

**Interface Contract:**
- Redux state: `layout.zoomLevel: number` (integer, default `0`)
- Actions: `zoomIn()`, `zoomOut()`, `resetZoom()`
- Scale factor derived as `Math.pow(1.1, zoomLevel)`

---

### LYT-004: Zoom Applies to Editor Font Size and Preview Transform

- **Status:** Active
- **Added:** 2026-04-23

The `zoomLevel` affects both the editor and preview panes, but by different mechanisms appropriate to each.

**Behavior:**
- **Editor (Monaco):** zoom adjusts the effective font size, scaling the base font by `1.1^zoomLevel`. Line height and layout reflow accordingly.
- **Preview:** zoom applies a CSS transform (or equivalent scaling) of `1.1^zoomLevel` to the rendered Markdown content.
- Both panes update in sync when `zoomIn` / `zoomOut` / `resetZoom` are dispatched.
- Zoom does not affect the outline, toolbar, or sidebar chrome.

**Interface Contract:**
- `EditorLayout` subscribes to `layout.zoomLevel` and passes the computed scale to both the editor font configuration and the preview container's transform style.

---

### LYT-005: Sidebar and Chrome Toggles

- **Status:** Active
- **Added:** 2026-04-23
- **Updated:** 2026-08-19 (unified-sidebar-redesign: `showWorkspaceSidebar` removed)

Three independent boolean toggles control visibility of auxiliary UI chrome: document outline, formatting toolbar, and the workspace/explorer column.

**Behavior:**
- `showOutline` — toggles the document outline panel (default `false`)
- `showToolbar` — toggles the Markdown formatting toolbar above the editor (default `true`)
- `showExplorer` — toggles the unified sidebar's workspace section column (default `true`)
- Each toggle is independent; toggling one does not affect the others

**Interface Contract:**
- Redux state: `layout.showOutline | showToolbar | showExplorer: boolean`
- Actions: `toggleOutline()`, `toggleToolbar()`, `toggleExplorer()`

---

### LYT-006: Per-Pane View Mode (paneViewModes)

- **Status:** Deprecated
- **Added:** 2026-04-23
- **Updated:** 2026-08-19
- **Source plan:** deprecated by unified-sidebar-redesign (specs/unified-sidebar)

**Deprecated.** Tracked a per-workspace-pane view mode for the multi-pane editor. The multi-pane editor was removed; the single editor uses the global `viewMode` (LYT-001). The ID is retained and never reused.

---

### LYT-007: Per-Pane Split Ratio (paneSplitRatios)

- **Status:** Deprecated
- **Added:** 2026-04-23
- **Updated:** 2026-08-19
- **Source plan:** deprecated by unified-sidebar-redesign (specs/unified-sidebar)

**Deprecated.** Tracked a per-workspace-pane split ratio for the multi-pane editor. The multi-pane editor was removed; the single editor uses the global `splitRatio` (LYT-002). The ID is retained and never reused.

---

### LYT-008: Focused-Pane Tracking (focusedPaneId)

- **Status:** Deprecated
- **Added:** 2026-04-23
- **Updated:** 2026-08-19
- **Source plan:** deprecated by unified-sidebar-redesign (specs/unified-sidebar)

**Deprecated.** Tracked which editor pane held focus so global actions could route to it. With a single editor pane, `workspaces.activeWorkspaceId` is the sole routing key. The ID is retained and never reused.

---

## Key Files

| File | Purpose |
|------|---------|
| `src/renderer/src/store/layoutSlice.ts` | Layout Redux slice: view mode, split ratio, zoom, chrome toggles |
| `src/renderer/src/components/Layout/EditorLayout.tsx` | Renders split/editor-only/preview-only panes, applies zoom and split ratio |

---

## Test Plan

Tests for LYT requirements should live under `specs/layout-view/tests/` and reference requirement IDs via trace comments (`// Traces: LYT-002`). Unit tests cover reducer behavior (clamping, bounds); e2e tests cover rendered pane behavior and zoom application.
