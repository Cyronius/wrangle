# Plan: Make All Keyboard Shortcuts Editable & Sync with Features

## Context

The Wrangle keyboard shortcuts system has a centralized command registry and a Preferences → Keyboard Shortcuts tab that *appears* to let users edit shortcuts, but in practice has several frustrating dead-ends:

1. **Default preset is read-only** — a "Copy to Custom" dance is required before any edit is possible.
2. **Native menu accelerators are hardcoded** — KBD-007 specced this as dynamic but it never landed.
3. **Four commands are marked `readOnly: true`** with no recourse: `view.zoomScroll`, `view.moveWindow`, `markdown.openFormatToolbar`, `app.closeDialog`.
4. **Command IDs diverge between menu and registry** — menu emits `theme:light`, registry has `view.themeLight`, etc.
5. **Menu has features without registry commands** — Reload, Force Reload, Toggle Fullscreen, Exit, Open Folder.
6. **Stale/dead commands** — `view.themeCycle` references the non-existent `'Lightish'` theme.

This plan delivers: every keyboard input visible in Preferences, editable in place (no copy-to-custom dance), reflected in the native menu, traceable to a real feature.

## Proposed Changes

### Modified Requirements

- **KBD-001 (Command Registry Shape)** — Replace `readOnly: boolean` and `bindingDisplay?: string` with a richer `bindingShape` field:
  ```ts
  bindingShape?: { suffix?: 'Scroll' | 'Drag' | 'Tap' }
  ```
  Commands with `bindingShape.suffix` render in the UI as `<editable-key> + <suffix>`. They participate in conflict detection only against commands with the same suffix. There are no longer any pure read-only entries.

- **KBD-002 (Built-in default preset is immutable)** — Semantics change: the default preset remains the source of factory defaults but is no longer the surface a user edits directly. Editing while on a built-in preset auto-creates a custom preset (`My Shortcuts` / `My Shortcuts (2)` / ...), switches to it, then applies the edit. The original `default` is still selectable for "restore" purposes. The Shortcuts tab no longer shows a read-only notice; recorders are no longer disabled.

- **KBD-007 (Menu accelerators reflect active preset)** — Promoted from "specced but not implemented" to actually implemented. The renderer publishes the active preset's bindings to main via a `shortcuts:bindings-updated` IPC channel. The main process rebuilds the application menu from a JSON-serializable schema each time bindings change.

- **KBD-008 (Shortcuts tab lists all commands)** — Add a "Mouse Gestures" subsection inside the View category for `bindingShape.suffix='Scroll'` and `'Drag'` entries. Remove the lock notice for the default preset.

### New Requirements

- **KBD-012: Auto-copy on first edit** — Editing a binding while a built-in preset is active must (1) clone the active built-in's bindings into a new custom preset, (2) call `setCurrentPreset(newName)`, (3) apply the edit to that preset. Naming rule: `My Shortcuts` if free, else `My Shortcuts (2)`, `My Shortcuts (3)`, etc. **Test category:** unit.

- **KBD-013: Menu IDs equal registry IDs** — The native menu emits the registry command ID via `menu:command` IPC. The renderer dispatches it through `executeCommand(id)` rather than a hand-curated switch. Legacy IDs (`file:new`, `theme:light`, `workspace:openFolder`, `view:editor-only`, etc.) are removed. **Test category:** integration.

- **KBD-014: Bindable mouse-modifier commands** — `view.zoomScroll`, `view.moveWindow`, `markdown.openFormatToolbar` accept a key-only binding (e.g. `Ctrl`, `Alt`, `Shift`); the command's mouse/tap action is fixed by code. Conflict detection partitions commands by `bindingShape.suffix` so `Ctrl+B` (`markdown.bold`) and `Ctrl+Scroll` (`view.zoomScroll`) do not conflict. **Test category:** unit.

- **KBD-015: New menu-backed commands** — `view.reload` (`Ctrl+R`), `view.forceReload` (`Ctrl+Shift+R`), `view.toggleFullscreen` (`F11`), `app.exit` (`Ctrl+Q`), `workspace.openFolder` (`Ctrl+K Ctrl+O`). Each has a registry entry with default binding and is reachable from menu, command palette, and shortcut. **Test category:** integration.

### Removed/Deprecated Requirements

- **`view.themeCycle`** removed from the registry (referenced non-existent `'Lightish'` theme; not bound; not in menu; not used).
- **`app.closeDialog`** removed from the registry. Escape-to-close is owned by each dialog component, not a registry command — documented as an architectural note.

## Implementation Notes

**Order:** spec plan → registry types → settings slice (auto-copy thunk) → shortcut-parser (partitioned conflicts, modifier-only) → useKeyboardShortcuts (mouse-modifier dispatch) → menu schema + IPC + main rebuild → preferences UI → App.tsx menu handler simplification → spec merge → archive.

**Key architectural pieces:**
- `src/shared/menu-schema.ts` (new) — declarative menu schema referencing registry IDs.
- `src/main/menu/menu-template.ts` — accepts `bindings: Record<string, string | null>`; rebuilds menu from schema; can be called repeatedly (Electron's `Menu.setApplicationMenu` replaces wholesale).
- `editShortcutBinding` thunk in `settingsSlice.ts` composes existing `addCustomPreset`, `setCurrentPreset`, `updateShortcutBinding` — does not duplicate logic.
- `findConflicts` extended to partition by `bindingShape.suffix`.
- `ShortcutRecorder` gains `mode: 'chord' | 'modifier-only' | 'tap'` prop.

**Window-drag investigation:** the move-window region is implemented via CSS `-webkit-app-region: drag` on `.tab-row-drag-spacer` (renderer-side declarative). Electron's drag-region uses the system's primary-button drag without any modifier-key gating — Alt+Drag is not actually how this currently works. The `view.moveWindow` registry entry was a misrepresentation of feature behavior. Resolution: keep the registry entry as a key-only binding for documentation/discoverability with `bindingShape.suffix='Drag'`, but treat its `execute` as a no-op (the OS handles dragging through the drag region). Document this in the spec.

## Spec Impact

- [x] New requirements added to spec (KBD-012..015)
- [x] Existing requirements updated in spec (KBD-001, 002, 007, 008)
- [x] Removed requirements documented (themeCycle, closeDialog as architectural note)
- [ ] Tests created/updated referencing requirement IDs (deferred — project lacks Vitest infrastructure; manual verification per spec section)
- [ ] Plan moved to archive (after implementation merges)

## Verification

End-to-end manual check:

1. **Auto-copy on first edit.** Fresh user, `default` preset active. Open Preferences → Keyboard Shortcuts → click Bold row → press `Ctrl+Alt+B`. Expect: `My Shortcuts` preset appears in dropdown and is selected; binding is `Ctrl+Alt+B`; no modal.
2. **Menu reflects custom preset.** With `Ctrl+Alt+B` set, open File menu — Save still shows `Ctrl+S`. Open custom preset; rebind File → Save to `Ctrl+Alt+S`; confirm File menu now shows the new accelerator.
3. **Mouse-modifier rebind.** Change View → Mouse Gestures → Zoom from `Ctrl + Scroll` to `Shift + Scroll`. Ctrl+Scroll no longer zooms; Shift+Scroll does.
4. **Tap rebind.** Change "Open Format Toolbar at Cursor" from `Alt (tap)` to `Shift (tap)`. Tap Alt → no toolbar. Tap Shift → toolbar appears.
5. **New commands work end-to-end.** Press F11 → fullscreen toggles. Press Ctrl+R → reload. Press Ctrl+K Ctrl+O → folder picker.
6. **Restore defaults.** Switch back to `default` — bindings revert; menu accelerators update.
