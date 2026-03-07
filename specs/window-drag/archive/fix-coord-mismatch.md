# Plan: Fix coordinate mismatch, ghost drag, and toggle-maximize bugs

## Context

Multiple previous attempts at fixing Alt+drag-from-maximized have failed because
the test suite masked the real bugs with artificial `waitForTimeout(100)` delays
after `mouse.down()`. Three root causes were identified by running tests without
those delays and by adding position-tracking assertions to the drag lifecycle.

Test evidence lives in `e2e/tests/window-drag-race.spec.ts`.

---

## Root Cause A — screenX coordinate system mismatch after unmaximize (primary)

### What happens
1. The window is maximized: its screen origin is `(0, 0)`.
2. The user presses Alt and clicks at viewport `(500, 350)`.
   `handleMouseDown` is called; `pendingDragRef = true`;
   `mouseStartRef = { screenX: 500, screenY: 350 }` (computed as `clientX + 0`).
3. The user moves the mouse > 5 px. `handleMouseMove` calls
   `unmaximizeForDrag(510, 353)`.
4. The WM unmaximizes the window and restores it to its saved normal bounds
   (e.g. `{ x: 680, y: 171 }`), ignoring the `setPosition` we requested.
5. The hook waits 30 ms, calls `getPosition()`, gets `{ x: 680, y: 171 }`, and sets:
   ```
   dragStartRef = { mouseScreenX: 510, windowX: 680 }
   ```
   `mouseScreenX = 510` was computed with the window at `x = 0`.
6. The next `mousemove` event fires. Chromium computes
   `e.screenX = clientX + window.screenLeft = 520 + 680 = 1200`.
7. The delta is `1200 - 510 = 690 px` instead of the intended `10 px`.
8. `setPosition(680 + 690 = 1370, ...)` flies the window to the right edge of
   the screen or onto a second monitor.

### Proof
- WD-COORD-001: `dx = 0` when drag should produce ~80 px of movement.
- WD-COORD-002: `dragDx = 0` in the full lifecycle test.
- WD-RACE-002: window position during drag is `x = 3240` (second monitor).

### Fix — `needsReAnchorRef`
Add a `reAnchorRef = useRef<{ windowX: number; windowY: number } | null>(null)`.

After `unmaximizeForDrag` settles and we read the actual position, instead of
setting `dragStartRef.mouseScreenX = e.screenX` (which belongs to the old
coordinate system), store only the window position:

```typescript
reAnchorRef.current = { windowX: actualPos.x, windowY: actualPos.y }
draggingRef.current = true
// dragStartRef intentionally left null until next mousemove
```

At the start of the active-drag path in `handleMouseMove`, if `reAnchorRef` is
set, complete the anchor using the *current* `e.screenX` (which is in the new
coordinate system):

```typescript
if (reAnchorRef.current) {
  dragStartRef.current = {
    mouseScreenX: e.screenX,
    mouseScreenY: e.screenY,
    windowX: reAnchorRef.current.windowX,
    windowY: reAnchorRef.current.windowY,
  }
  reAnchorRef.current = null
  return   // skip setPosition on this anchoring frame
}
```

The window skips one frame of movement (the anchor frame) but then tracks the
cursor exactly. This is imperceptible to the user.

---

## Root Cause B — Ghost drag after rapid mousedown + mouseup (secondary)

### What happens
`handleMouseDown` is `async`. It awaits `isMaximized()` (~10-30 ms) and
`getPosition()` (~10-30 ms) before setting `draggingRef = true`.

If the user releases the mouse before those awaits complete:
1. `handleMouseUp` fires: resets all refs including `draggingRef = false`,
   `mouseButtonDownRef = false`.
2. The async continuation of `handleMouseDown` resumes after the awaits and sets
   `draggingRef = true`, `dragStartRef = { ... }`.

The hook is now in "dragging" state with no mouse button held. The next
`mousemove` event (even without Alt) triggers `setPosition` and moves the window.

### Proof
- WD-RACE-003: window moved **300 px** after rapid click-release, without Alt held.

### Fix — Guard `mouseButtonDownRef` after each await
After every `await` in `handleMouseDown`, check `mouseButtonDownRef.current`
before proceeding. If the mouse was released during the IPC round-trip, return
immediately without touching drag state:

```typescript
const isMax = await window.electron.window.isMaximized()
if (!mouseButtonDownRef.current) return   // mouse released during IPC

if (!isMax) {
  const pos = await window.electron.window.getPosition()
  if (!mouseButtonDownRef.current) return // mouse released during second IPC
  // ... set drag state
}
```

---

## Root Cause C — `window:maximize` is a toggle, not force-maximize (tertiary)

### What happens
`handleMouseUp` re-maximizes via:
```typescript
window.electron.window.maximize()   // sends "window:maximize"
```
The IPC handler **toggles**:
```typescript
if (window?.isMaximized()) {
  window.unmaximize()     // ← wrong if already maximized
} else {
  window?.maximize()
}
```
If anything has maximized the window in the ~50 ms between mouseup and the
timeout (a WM snap, a parallel maximize call, etc.), the toggle fires on an
already-maximized window and **unmaximizes** it.

### Proof
- WD-RACE-007: after a drag from maximized where the WM re-maximizes mid-drag,
  the toggle call results in `maximized = false` instead of `true`.

### Fix — Add `window:forceMaximize` IPC
Add a one-way IPC handler that always maximizes (never toggles):

```typescript
ipcMain.on('window:forceMaximize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (win && !win.isMaximized()) {
    win.maximize()
  }
})
```

Expose it in the preload as `window.electron.window.forceMaximize()` and use
it in `handleMouseUp` instead of `maximize()`.

---

## Proposed Changes

### New Requirements
None — these are all fixes to existing requirements (WD-001, WD-002).

### Modified Requirements
- **WD-002** — Clarify that the re-maximize call must be idempotent (force, not
  toggle) and that cursor tracking must be accurate after unmaximize.

---

## Files to change

| File | Change |
|------|--------|
| `src/renderer/src/hooks/useWindowDrag.ts` | Add `reAnchorRef`; guard `mouseButtonDownRef` after awaits; use `forceMaximize` |
| `src/main/ipc/window-handler.ts` | Add `window:forceMaximize` handler |
| `src/preload/index.ts` | Expose `forceMaximize` via `contextBridge` |
| `src/preload/electron.d.ts` | Add `forceMaximize: () => void` to window type |
| `e2e/tests/window-drag-race.spec.ts` | Tests that PROVE the fix (should pass after changes) |
| `specs/window-drag/spec.md` | Update WD-002 wording |

---

## Spec Impact
- [ ] WD-002 updated in spec to clarify cursor-tracking accuracy and idempotent re-maximize
- [ ] Tests WD-RACE-003, WD-RACE-007, WD-COORD-001, WD-COORD-002 pass after fix
- [ ] Plan moved to archive
