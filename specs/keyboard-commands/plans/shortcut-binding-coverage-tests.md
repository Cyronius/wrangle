# Plan: Shortcut Binding Coverage Tests

## Context

A manual audit of preferences shortcuts revealed three classes of bug that the existing spec did not require us to verify:

1. **Dead bindings.** Several commands (`view.toggleSync`, `view.workspaceSidebar`, the gone `view.moveWindow`, etc.) appeared in the Preferences UI with default keystrokes but had no live runtime listener for those keystrokes. Pressing the shortcut did nothing.
2. **Hardcoded shadow handlers.** A 230-line block in `App.tsx` had a parallel keydown listener keyed on literal default keystrokes. Customizing a shortcut in Preferences only added the new key (via the menu accelerator path); the original default still fired through the hardcoded handler. Two keys per command, neither cleanly disabling the other.
3. **Wired but only partially.** `view.editorOnly`/`view.split`/`view.previewOnly` were dispatched correctly through one path (hardcoded, pane-aware) and incorrectly through another (registry, not pane-aware). The two paths produced visibly different behavior for the same command.

KBD-004 says the dispatcher uses the bindings; KBD-007 says menu accelerators reflect the active preset; KBD-015 says the listed commands are rebindable. Yet the user reports that 3 of 4 shortcuts they tried still don't work after the fix landed. The spec is missing the property that *would* have caught this: **a shortcut listed in the Preferences UI with a non-null binding must be the one and only keystroke that triggers the command, and it must trigger it from any focus context where the spec says it applies**.

We need a single requirement that asserts this end-to-end, plus an automated test harness that exercises every command in the registry against it. Without that, every future regression in this area is invisible until a user files a bug.

There is currently no test infrastructure at all — no Vitest config, no `specs/package.json`, no test runner. The spec acknowledges this on line 423: *"as of 2026-04-28 the project does not yet have a Vitest config. Tests for KBD-001..015 are tracked but unwritten."* This plan is the first concrete test scaffolding for the keyboard system, so it must also stand up the Vitest infrastructure that KBD-001..010 / 012 / 013 / 014 / 015 will eventually use.

## Proposed Changes

### New Requirements

- **KBD-016: Every Bound Command Is Reachable From Its Active Binding** — A command with a non-null binding in the active preset must execute when the bound keystroke is pressed in the focus context the command targets, and must NOT execute when its previous default is pressed after rebinding. This is the property that distinguishes "the binding shows up in Preferences" from "the binding actually works."

  - **Applies to:** wrangle
  - **Test category:** unit
  - **Behavior:**
    - For every command in the registry whose `defaultBinding` is a non-null chord-style accelerator (i.e. excluding `bindingShape.suffix` mouse-gesture commands and chord-sequence accelerators like `Ctrl+K Ctrl+O`), pressing the binding from the appropriate focus context fires `command.execute(ctx)` exactly once.
    - "Appropriate focus context" is one of: `editor` (Monaco editor focused — markdown formatting, edit.toggleCase, edit.lowercase), `global` (window focus, no input element — file/view/nav/app commands), `input` (an input/textarea/contentEditable element focused — only the `INPUT_ALLOWED_COMMANDS` allowlist may fire). Each command declares which contexts it applies to.
    - After rebinding a command via `editShortcutBinding({ commandId, shortcut })`, the new keystroke fires it and the original default keystroke does NOT.
    - When two commands' contexts overlap and their bindings collide (e.g. both bound to `Ctrl+B`), exactly one fires per keystroke (whichever the dispatcher prioritizes); the test asserts no double-fire.
  - **Acceptance criteria:**
    - Given the default preset and a fresh dispatcher, dispatching a synthetic `KeyboardEvent` for `Ctrl+S` from `document.body` results in `commandMap.get('file.save').execute` having been called exactly once.
    - After `editShortcutBinding({ commandId: 'file.save', shortcut: 'Ctrl+Alt+S' })`, dispatching `Ctrl+S` results in zero calls to `file.save`'s execute; dispatching `Ctrl+Alt+S` results in exactly one.
    - For every command meeting the inclusion criteria above, the parameterized table-test asserts both directions (default fires; rebound default does not fire).
    - For every command in the `INPUT_ALLOWED_COMMANDS` allowlist, dispatching the binding from a focused `<input>` fires it once. For every command NOT in the allowlist, dispatching its binding from a focused `<input>` fires zero times.

- **KBD-017: No Hardcoded Keystroke Handlers For Registry Commands** — Code outside the registry/dispatcher must not handle keystrokes by literal-string match for any command that exists in the registry. The presence of such a handler is a guaranteed regression of KBD-016 (because customization will not propagate to it).

  - **Applies to:** wrangle
  - **Test category:** unit
  - **Behavior:**
    - A static analysis test scans `src/renderer/src/**/*.{ts,tsx}` for `KeyboardEvent`-handling code that compares `e.key` / `event.key` to a literal value also held by `commandMap.get(id).defaultBinding` for some `id`.
    - Listed exemptions (each with a justification comment in source): the tap-modifier handler in `App.tsx` (compares to a configured *modifier name*, not a chord), the wheel-zoom handler in `App.tsx` (uses `eventMatchesModifier`, not literal compare), and any third-party library code under `node_modules`.
    - New literal handlers fail the test until either (a) they are removed and replaced with registry dispatch, or (b) they are added to the explicit exemption list with rationale.
  - **Acceptance criteria:**
    - The static analysis function `findHardcodedKeystrokeHandlers(srcRoot)` returns `[]` against the current repo.
    - Reintroducing a literal `(e.ctrlKey || e.metaKey) && e.key === 's'` style block in any non-exempt file makes the test fail with a message naming the file, line, and offending literal.

### Modified Requirements

- **KBD-004** — extend the **Acceptance criteria** section to require that the global-vs-input dispatch logic is unit-tested with a mocked dispatcher: synthetic events from `document.body`, from an `<input>` element, and from a `contentEditable` element each route through the documented allowlist. This was previously implicit in the Behavior section but never asserted.

- **KBD-007** — extend the **Acceptance criteria** to require an integration-style test (still Vitest, no Electron) that confirms `createApplicationMenu(win, bindings)` produces accelerator strings matching the registry's current bindings for every interactive node in `menuSchema`. Stub the `BrowserWindow` and verify the assembled `MenuItemConstructorOptions[]`.

### Removed Requirements

None.

### Test Infrastructure (Net-New)

- Add `specs/package.json` with a working `"test": "vitest run"` script.
- Add `specs/vitest.config.ts` with `environment: 'jsdom'` (needed for `KeyboardEvent` synthesis and DOM-focus tests) and a path alias to `src/`.
- Add minimal `jsdom`, `vitest`, `@testing-library/dom` dev dependencies to the root `package.json`.
- Tests live in `specs/keyboard-commands/tests/` per the spec's Test File Structure.

## Spec Impact

- [x] New requirements added to spec (KBD-016, KBD-017)
- [x] Existing requirements updated in spec (KBD-004, KBD-007 acceptance criteria)
- [ ] Tests created/updated referencing requirement IDs (this plan creates the first executable tests in the project — see Implementation Order)
- [ ] Plan moved to archive

---

## Implementation Order (TDD)

The doctrine requires a real failing test before any new code. KBD-016/017 are unit-category requirements, so each gets a real test before implementation.

1. **Stand up Vitest.** Add `specs/package.json`, `specs/vitest.config.ts`, install deps. Verify `cd specs && npm test` runs (with zero tests) and exits 0.

2. **Write the KBD-016 dispatch table-test (RED).** A parameterized test that, for every command in `commands` matching the inclusion criteria, builds a fresh dispatcher (`useKeyboardShortcuts` extracted into a callable that doesn't require React rendering — see Open Questions below), synthesizes the `KeyboardEvent` for the default binding, and asserts exactly one call to a spy `execute`. Run it. Confirm a real failure for at least one command — the user reports 3 of 4 they tried don't work, so failures are expected.

3. **Write the KBD-016 rebind test (RED).** Same harness, but first dispatches `editShortcutBinding({ commandId, shortcut: '<unique alt>' })`, then asserts the new key fires once and the old default fires zero times. Run it. Expected to fail for any command whose dispatch path bypasses the registry.

4. **Write the KBD-017 static-analysis test (RED).** Walk `src/renderer/src/**/*.{ts,tsx}`, parse for keystroke-comparison patterns, cross-reference against `commands[].defaultBinding`. Run against current source. Should be GREEN already (we removed the hardcoded handler in the prior session) — but it locks the property in place so future regressions fail fast.

5. **Fix the failures from steps 2–3.** Each failure points at a concrete bug: a command that thinks it's bound but no path listens for it, or a path that ignores customizations. Fix the dispatcher (or the registry entry) until the table-test goes green for every included command.

6. **Write the KBD-004 supplementary test.** Three small tests: synthetic event from `body` → routes via `globalCommands`; from `input` → only allowlist fires; from `contentEditable` → only allowlist fires. Should pass once the dispatcher is correct.

7. **Write the KBD-007 menu test.** Stub `BrowserWindow`, call `createApplicationMenu`, walk the resulting template, assert each interactive node's accelerator equals the registry binding (with `Ctrl` → `CmdOrCtrl` translation).

8. **Update `spec.md`.** Add KBD-016 and KBD-017 in full, append acceptance criteria to KBD-004 and KBD-007, regenerate the test-file table.

9. **Archive this plan.**

---

## Open Questions (Need User's Call Before Implementation)

These shape the test design enough that I'd rather get them resolved up-front than guess.

**Q1. Should `useKeyboardShortcuts` be refactored to expose a non-React-coupled dispatcher that the test can call directly, or should the test mount a minimal React tree with the hook?**

The hook currently reads `bindings` from `useSelector` and registers a `window.addEventListener('keydown', ...)`. To unit-test it, either:
- (a) Extract the matching-and-execute logic into a pure function `dispatchKeydownEvent(event, bindings, commandMap, handlers, focusContext)` that the hook calls. The test calls the pure function directly; the hook is a thin shell.
- (b) Render the hook inside a Redux Provider in jsdom, dispatch synthetic events on `window`, and verify execute spies.

(a) is faster, more deterministic, and easier to debug. (b) tests the actual integration. I'd default to (a) and add one (b)-style smoke test per focus context, but flag that **(a) requires a small refactor of the hook** which is part of the implementation, not just the test.

**Q2. Chord-sequence bindings (e.g. `workspace.openFolder` → `Ctrl+K Ctrl+O`) and mouse-gesture bindings — in scope for KBD-016 or excluded?**

The doctrine says a requirement should test specified behavior. Chord sequences don't currently work end-to-end (Electron menu accelerators don't support them, and `matchesShortcut` is single-press). Mouse gestures don't go through `keydown` at all. I propose KBD-016 explicitly excludes both, and a follow-up plan creates KBD-018 (chord sequences) and KBD-019 (mouse gestures) when those are actually implemented. Otherwise we'd be writing tests for behavior the system has never claimed to support.

**Q3. The KBD-017 static-analysis test — AST-based or regex-based?**

Regex is faster to write and probably catches the obvious cases (`e.key === 's'`, `event.key === 'P'`). AST is more robust but pulls in `@babel/parser` or similar. I'd propose regex for v1 with a TODO to upgrade if it generates false positives. The exemption list lets us silence anything the regex over-flags.

**Q4. Do we want an end-to-end Playwright test on top of the unit tests, or are unit tests sufficient?**

The existing `e2e/` directory has Playwright tests for other features. A keyboard E2E test would actually launch Electron, focus the editor, send a keystroke via `page.keyboard.press`, and assert the resulting state. This catches integration bugs the unit tests miss (e.g. Monaco swallowing the event, focus actually being where we think it is) but is much slower and flakier. My recommendation: unit tests for KBD-016 across all commands; one Playwright test per focus context as a smoke check (~3 tests total). But I want explicit user sign-off before adding to the E2E suite, since it grows test runtime.

---

## Estimated Scope

- Test infrastructure setup: ~30 min
- KBD-016 unit table-test: ~1–2 hr (most of the time is in the hook refactor from Q1)
- KBD-017 static-analysis test: ~30 min
- Fixing the failures KBD-016 surfaces: unknown — depends on what the user is reporting "doesn't work." Could be 30 min, could be a half-day if multiple commands have separate broken paths.
- KBD-004 / KBD-007 supplementary tests: ~30 min each
- Spec update + archive: ~15 min

Total: roughly half a day to a full day of work, dominated by however many concrete bugs the table-test reveals.
