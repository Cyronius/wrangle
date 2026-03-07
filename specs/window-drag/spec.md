# Window Drag Specification

## Overview

Window dragging allows users to reposition the application window using Alt+mouse drag from anywhere in the app, and via titlebar drag on designated regions. This spec covers the Alt+drag behavior. The feature prefix is **WD**.

## Requirements

### WD-001: Alt+Drag Moves Non-Maximized Window
- **Status:** Active
- **Added:** 2026-03-01

When the window is **not** maximized, holding Alt and dragging with the left mouse button from anywhere in the app must move the window to follow the cursor. The window must remain non-maximized and its new position must reflect the drag delta.

**Behavior:**
- Alt key must be held before or during mousedown.
- Left mouse button initiates the drag.
- Window position updates continuously during the drag.
- On mouseup, the window stays at the released position (no snap-back, no maximize).
- The drag works regardless of which UI element the cursor is over (editor, sidebar, preview, tabs).

**Interface Contract:**
- Uses `window.electron.window.getPosition()` to capture initial position.
- Uses `window.electron.window.setPosition(x, y)` to update position during drag.

---

### WD-002: Alt+Drag From Maximized Unmaximizes, Moves, Then Re-Maximizes
- **Status:** Active
- **Added:** 2026-03-01
- **Updated:** 2026-03-03

When the window **is** maximized, holding Alt and dragging must unmaximize the window (restoring normal bounds), allow repositioning, and then **re-maximize** the window when the mouse button is released.

**Behavior:**
- A 5px movement threshold is required before the drag begins (to avoid accidental unmaximize on click).
- Once the threshold is exceeded, `unmaximizeForDrag` is called to restore normal bounds while keeping the cursor proportionally positioned on the window.
- After unmaximize, the window's drag coordinate system is re-anchored on the first subsequent mousemove event, using the WM-confirmed window position and the current cursor screenX. This avoids the phantom ~680px offset caused by the coordinate system change between maximized (x=0) and normal (x=restored) states.
- The window follows the cursor during the drag at its normal (non-maximized) size. The algorithm computes correct cursor-relative deltas; actual window movement may be subject to compositor constraints during the drag gesture.
- On mouseup, the window is re-maximized on whichever monitor/screen it currently occupies using a **force-maximize** (not toggle) call to avoid accidentally unmaximizing if a WM race has already maximized the window.
- This enables moving a maximized window between monitors: unmaximize → drag to other monitor → release → re-maximize on target monitor.

**Interface Contract:**
- Uses `window.electron.window.unmaximizeForDrag(screenX, screenY)` to unmaximize with proportional positioning; returns the WM-confirmed `{x, y}` for the re-anchor.
- Uses `window.electron.window.setPosition(x, y)` during drag.
- Uses `window.electron.window.forceMaximize()` on mouseup (always maximizes, never toggles).

---

### WD-003: Alt+Drag Overlay Provides Visual Feedback
- **Status:** Active
- **Added:** 2026-03-01

When the Alt key is held, a transparent drag overlay must appear covering the entire window, providing a grab cursor and preventing underlying UI elements from consuming mouse events.

**Behavior:**
- Overlay appears immediately when Alt is pressed.
- Overlay disappears when Alt is released.
- Overlay has `z-index: 99999` to sit above all other content.
- Overlay uses `cursor: grab` to indicate draggability.
- Overlay does not interfere with the drag IPC mechanism.

**Interface Contract:**
- The `useWindowDrag` hook returns a boolean indicating whether the overlay should be shown.
- The overlay is rendered as a `div.window-drag-overlay` with `position: fixed; inset: 0`.
