# Plan: Chord-Sequence and Mouse-Gesture Bindings

## Context

The KBD-016 binding-coverage test (added by `shortcut-binding-coverage-tests`) intentionally surfaces three commands today as RED:

- `workspace.openFolder` — default `Ctrl+K Ctrl+O` (chord sequence)
- `view.zoomScroll` — default `Ctrl` (modifier + Scroll)
- `markdown.openFormatToolbar` — default `Alt` (modifier tap)

KBD-016 demands that any non-null binding be reachable from its keystroke. None of these are reachable through the current dispatcher:

- `matchesShortcut(event, binding)` is single-press; it cannot recognize a two-chord sequence like `Ctrl+K Ctrl+O`.
- The wheel-zoom and tap-Alt handlers in `App.tsx` *are* binding-driven (they read `selectModifierBinding`), but they are not commands routed through the registry's dispatcher — they live as ad-hoc `useEffect`s. That works for the modifier read, but it means:
  1. The `view.zoomScroll` and `markdown.openFormatToolbar` registry entries are documentation-only; the binding test cannot discover that pressing the binding fires `command.execute(ctx)`, because the ad-hoc handlers call `floatingToolbarBus.openAtCursor()` and `dispatch(zoomIn/Out)` directly without going through the registry.
  2. If a user-defined custom preset binds, say, `view.zoomScroll` to `Shift`, the wheel handler reads it correctly — but no equivalent of `command.execute(ctx)` ever runs, so any future logic added to that command's `execute` would be invisible.

This plan addresses both gaps.

## Proposed Changes

### New Requirements

- **KBD-018: Chord-Sequence Bindings** — A binding string containing a space (e.g. `Ctrl+K Ctrl+O`) is a sequence of chords that must all be pressed in order, within a configurable timeout (default 1500ms), to fire the command. The dispatcher tracks an in-progress chord prefix and resolves it when either (a) a matching next chord arrives, completing the sequence, or (b) a non-matching key, mouse event, focus loss, or timeout cancels the prefix.

  - **Applies to:** wrangle
  - **Test category:** unit
  - **Behavior:**
    - When a binding is a single-chord string (no internal space), behavior is identical to KBD-004 today — single-press dispatch.
    - When a binding is a chord-sequence string, the dispatcher ignores the keypress for the first N−1 chords (preventDefault is still called to avoid native handling), tracks the prefix, and fires `command.execute(ctx)` exactly once on receipt of the final matching chord.
    - A non-matching keypress, a mouse-down, a window blur, or `timeout` ms with no further keypress all reset the prefix to empty.
    - Prefix tracking is per-window (single in-progress sequence at a time). If a user customizes two commands to share a prefix (e.g. `Ctrl+K Ctrl+O` and `Ctrl+K Ctrl+P`), both are eligible until the second chord disambiguates.
    - Existing `findConflicts` correctly flags two commands sharing the *exact* same chord-sequence binding; no change to KBD-014 conflict detection.
    - Menu accelerators (KBD-007): chord-sequence bindings are NOT rendered in the native menu (Electron does not support multi-chord accelerators in `accelerator:`). The menu omits the accelerator label for these commands. The Preferences tab continues to show the full chord-sequence string.
  - **Acceptance criteria:**
    - Given `bindings = { 'workspace.openFolder': 'Ctrl+K Ctrl+O' }`, dispatching `Ctrl+K` then `Ctrl+O` from `document.body` results in `workspace.openFolder.execute` having been called exactly once.
    - Given the same bindings, dispatching `Ctrl+K` then `Ctrl+P` (any non-matching) results in zero calls; a follow-up `Ctrl+K Ctrl+O` fires exactly once.
    - Given two commands `cmd.a: 'Ctrl+K Ctrl+O'` and `cmd.b: 'Ctrl+K Ctrl+P'`, dispatching `Ctrl+K Ctrl+O` fires only `cmd.a`; `Ctrl+K Ctrl+P` fires only `cmd.b`.
    - Given `bindings = { 'workspace.openFolder': 'Ctrl+K Ctrl+O' }`, dispatching `Ctrl+K`, waiting 2000ms, then dispatching `Ctrl+O` results in zero calls.

- **KBD-019: Mouse-Gesture Commands Route Through The Registry** — Commands with `bindingShape.suffix` (`Scroll`, `Drag`, `Tap`) must dispatch their `execute` through the registry on the configured gesture, rather than calling side-effects directly from ad-hoc handlers in `App.tsx`. The handlers in `App.tsx` become thin event-source adapters that determine "the configured modifier+gesture happened" and then call `commandMap.get(id).execute(ctx)`.

  - **Applies to:** wrangle
  - **Test category:** unit
  - **Behavior:**
    - `view.zoomScroll` — the wheel handler in `App.tsx` reads `selectModifierBinding(state, 'view.zoomScroll')`; on a matching wheel event, it calls `commandMap.get('view.zoomScroll').execute(ctx)` instead of dispatching `zoomIn` / `zoomOut` directly. The command's `execute` reads `event.deltaY` (passed in via a new `gestureEvent` field on `CommandContext` or by reading from a shared bus) and dispatches the zoom action.
    - `markdown.openFormatToolbar` — the tap-Alt handler in `App.tsx` calls `commandMap.get('markdown.openFormatToolbar').execute(ctx)` on a successful tap, instead of calling `floatingToolbarBus.openAtCursor()` directly.
    - `view.moveWindow` — Electron's CSS-based `-webkit-app-region: drag` is OS-mediated and not currently routed through any keyboard dispatcher. KBD-019 acknowledges this: the test for `view.moveWindow` is documented as `manual` (no automated coverage; binding remains documentation-only as described in KBD-014). The KBD-016 mouse-gesture parameterization excludes `view.moveWindow`.
  - **Acceptance criteria:**
    - Given `bindings = { 'view.zoomScroll': 'Ctrl' }`, dispatching a synthetic `WheelEvent({ ctrlKey: true, deltaY: 100 })` results in `commandMap.get('view.zoomScroll').execute` having been called exactly once with a context that exposes the wheel event's deltaY.
    - Given `bindings = { 'markdown.openFormatToolbar': 'Alt' }`, dispatching `keydown(Alt)` then `keyup(Alt)` within 500ms with no intervening event results in `commandMap.get('markdown.openFormatToolbar').execute` having been called exactly once.
    - After rebinding `view.zoomScroll` to `Shift`, a `Ctrl+Wheel` event fires zero calls and a `Shift+Wheel` event fires exactly one.

### Modified Requirements

- **KBD-014** — note that the wheel/tap dispatchers now call `command.execute(ctx)` rather than performing side-effects inline. The "active modifier read from binding" wording stays; the dispatch destination moves.

- **KBD-016** — once KBD-018 and KBD-019 are implemented, the parameterized table-test's "expected red" sub-suites (currently 3 cases) move to the main suite and are required to pass.

### Removed Requirements

None.

## Spec Impact

- [ ] New requirements added to spec (KBD-018, KBD-019)
- [ ] KBD-014 updated to reference the new dispatch destination
- [ ] KBD-016 updated: drop the "expected red" sub-suites in the test once these land
- [ ] Tests created/updated referencing KBD-018, KBD-019
- [ ] Plan moved to archive

## Implementation Order (TDD)

1. **KBD-019 first** (smaller, no state machine). Refactor the wheel and tap-Alt handlers in `App.tsx` to call `commandMap.get(id).execute(ctx)`. Add `gestureEvent?: WheelEvent | KeyboardEvent` to `CommandContext`. Update `view.zoomScroll` and `markdown.openFormatToolbar` `execute` functions to consume `ctx.gestureEvent` and perform the previous side-effect (zoom dispatch / openAtCursor). The KBD-019 acceptance tests use the same `dispatchKeydownEvent`-style harness; for wheel events, write a new `dispatchWheelEvent`. Confirm the KBD-016 mouse-gesture sub-suite goes green.

2. **KBD-018**. Extend `dispatchKeydownEvent` to track an in-progress chord prefix. The dispatcher's signature gains a `state` parameter (`{ prefix: string[]; lastAt: number }`) so tests can drive multi-chord sequences without React. Hook this into `useKeyboardShortcuts` via a `useRef` for the prefix state. Add timeout/cancel/blur handling. Confirm the KBD-016 chord-sequence sub-suite goes green.

3. **Update spec.md** with KBD-018 and KBD-019 in full. Update the test-file table.

4. **Archive this plan.**

## Open Questions

- **Should the chord-sequence timeout be user-configurable?** Default 1500ms is what VS Code uses. Probably yes, behind an editor setting, but not in scope for v1.
- **Does `markdown.openFormatToolbar` still need the existing dedicated `useEffect` after the refactor, or does the registry dispatcher subsume it?** The tap detection (press + release ≤500ms with no intervening event) is gesture logic, not command logic — it stays in the App.tsx handler as the event source. The change is just where the side-effect lives.
