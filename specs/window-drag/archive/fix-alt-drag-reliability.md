# Plan: Fix Alt+Drag Reliability

## Context

The Alt+drag window movement feature has been unreliable. Multiple prior attempts have failed to produce a stable implementation. Root cause analysis identified:

1. **Stale closure bug**: `useWindowDrag` uses React state (`altHeld`) inside a `useCallback` with `[altHeld]` dependency. Because React state updates are async/batched, there's a race window where Alt is pressed but `handleMouseDown` still sees `altHeld = false`. This makes Alt+drag intermittently fail.

2. **Missing re-maximize on release**: When dragging a maximized window, the current code unmaximizes but never re-maximizes on mouseup. Requirement WD-002 specifies re-maximize behavior.

3. **Event listener churn**: Because `handleMouseDown` depends on `altHeld` state, the useEffect re-registers ALL event listeners every time Alt is toggled. This creates race conditions with pending async operations.

4. **Blur/keyup kills active drags**: Window state transitions (unmaximize, reposition) cause the Linux WM to fire transient blur and keyup events. The old handlers unconditionally reset all drag state on these events, killing the drag mid-transition.

5. **WM position override after unmaximize**: On some Linux WMs, `setPosition()` immediately after `unmaximize()` gets overridden by the WM's own transition animation. The code used the requested position rather than re-reading the actual position.

## Proposed Changes

### Modified Requirements
- **WD-001** — Fix reliability by using a ref (`altHeldRef`) instead of React state for the mousedown guard. State is kept only for rendering the overlay.
- **WD-002** — Implement re-maximize on mouseup when drag started from maximized state. Add `wasMaximizedRef` to track origin state. Protect active drags from blur/keyup.

### Implementation Details

1. Add `altHeldRef = useRef(false)` — updated synchronously in keydown/keyup handlers.
2. `handleMouseDown` checks `altHeldRef.current` instead of `altHeld` state, removing it from the dependency array.
3. Add `wasMaximizedRef = useRef(false)` — set to `true` when drag starts from maximized.
4. In `handleMouseUp`, if `wasMaximizedRef.current` is true, call `window.electron.window.maximize()` after a brief delay to let position settle.
5. All handler useCallbacks get stable (empty) dependency arrays since they use refs, not state.
6. Add `unmaximizingRef` to cover the gap between pendingDrag=false and dragging=true during the async unmaximizeForDrag IPC call.
7. Add `mouseButtonDownRef` to track physical mouse button state independently of drag state.
8. `handleBlur` and `handleKeyUp` check `isDragActive()` and `mouseButtonDownRef` before resetting — if any drag phase is in progress, skip the reset.
9. After `unmaximizeForDrag`, wait 30ms then re-read actual window position via `getPosition()` to handle WM overrides.
10. Self-healing: if mousemove fires with button held and drag state was disrupted, re-anchor from current position.

## Spec Impact
- [x] Existing requirements updated in spec (WD-001 reliability, WD-002 re-maximize)
- [x] Tests created/updated referencing requirement IDs
- [x] Plan moved to archive
