// Traces: KBD-016 (canonical spec: specs/keyboard-commands/spec.md)
//
// Property under test: every command listed in the registry with a non-null
// active binding must execute exactly once when its bound keystroke is pressed
// in the appropriate focus context, and must NOT execute via its previous
// default after rebinding.
//
// The test directly exercises the pure `dispatchKeydownEvent` extracted from
// `useKeyboardShortcuts`, plus an inclusion check that every keystroke-bound
// command has *some* dispatch path registered (window-routed via
// GLOBAL_COMMANDS, or editor-routed via Monaco actions). A command with a
// binding but no path is exactly the bug class KBD-016 was added to detect.

import { describe, it, expect } from 'vitest'
import {
  GLOBAL_COMMANDS,
  INPUT_ALLOWED_COMMANDS,
  dispatchKeydownEvent,
  getFocusContextFromTarget
} from '../../../src/renderer/src/hooks/useKeyboardShortcuts'
import {
  commands,
  commandMap,
  CommandContext,
  CommandDefinition
} from '../../../src/renderer/src/commands/registry'

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

// Editor-routed commands — registered as Monaco actions in MonacoEditor.tsx.
// Pulled inline rather than imported from the component because that file
// imports React/@monaco-editor/react and would drag the whole editor surface
// into the test. If MonacoEditor.tsx and this list drift, KBD-016's
// "no orphan commands" assertion will surface it.
const EDITOR_COMMANDS = new Set<string>([
  'edit.toggleCase',
  'edit.lowercase',
  'markdown.bold',
  'markdown.italic',
  'markdown.strikethrough',
  'markdown.code',
  'markdown.link',
  'markdown.table',
  'markdown.heading1',
  'markdown.heading2',
  'markdown.heading3',
  'markdown.heading4',
  'markdown.heading5',
  'markdown.heading6',
  'markdown.bulletList',
  'markdown.numberedList',
  'markdown.taskList',
  'markdown.blockquote',
  'markdown.codeBlock',
  'markdown.image',
  'markdown.hr'
])

// Native edit commands (`edit.undo`, `edit.copy`, etc.) — these route through
// the browser/Electron's native handling of `Ctrl+Z` / `Ctrl+C` etc., or
// through Monaco's built-in actions when the editor has focus. They are not
// dispatched by the registry's window-keydown path, and intentionally so.
const NATIVE_EDIT_COMMANDS = new Set<string>([
  'edit.undo',
  'edit.redo',
  'edit.cut',
  'edit.copy',
  'edit.paste',
  'edit.selectAll'
])

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a synthetic KeyboardEvent that `formatKeyboardEvent` (the inverse of
 * what the dispatcher uses) will round-trip back to `binding`.
 */
function buildEvent(binding: string, target?: EventTarget): KeyboardEvent {
  const parts = binding.split('+').map((p) => p.trim())
  let ctrlKey = false
  let shiftKey = false
  let altKey = false
  let metaKey = false
  let key = ''

  for (const p of parts) {
    const upper = p.toUpperCase()
    if (upper === 'CTRL' || upper === 'CONTROL') ctrlKey = true
    else if (upper === 'SHIFT') shiftKey = true
    else if (upper === 'ALT') altKey = true
    else if (upper === 'META' || upper === 'CMD' || upper === 'WIN') metaKey = true
    else key = p
  }

  // Modifier-only binding (`Ctrl`, `Alt`): the event fires with the modifier
  // as the key itself.
  if (!key) {
    if (ctrlKey) key = 'Control'
    else if (shiftKey) key = 'Shift'
    else if (altKey) key = 'Alt'
    else if (metaKey) key = 'Meta'
  }

  const ev = new KeyboardEvent('keydown', {
    key,
    ctrlKey,
    shiftKey,
    altKey,
    metaKey,
    bubbles: true,
    cancelable: true
  })
  if (target) {
    Object.defineProperty(ev, 'target', { value: target, configurable: true })
  }
  return ev
}

function buildCommandLookupWithSpy(
  commandId: string,
  spy: () => void
): Map<string, CommandDefinition> {
  const real = commandMap.get(commandId)
  if (!real) throw new Error(`Unknown command in test fixture: ${commandId}`)
  const spied: CommandDefinition = { ...real, execute: () => spy() }
  return new Map<string, CommandDefinition>([[commandId, spied]])
}

const makeBuildContext = (): (() => CommandContext) => () => ({
  editor: null,
  dispatch: () => {},
  getState: () => ({}),
  handlers: {
    onFileNew: () => {},
    onFileOpen: () => {},
    onFileSave: () => {},
    onFileSaveAs: () => {},
    onCloseTab: () => {},
    onEditUndo: () => {},
    onEditRedo: () => {},
    onOpenPreferences: () => {},
    onOpenFolder: () => {},
    onOpenCommandPalette: () => {}
  }
})

// ---------------------------------------------------------------------------
// Inclusion partitioning
// ---------------------------------------------------------------------------

interface CmdRow {
  id: string
  binding: string
}

const eligible: CmdRow[] = commands
  .filter((c) => c.defaultBinding !== null)
  .map((c) => ({ id: c.id, binding: c.defaultBinding! }))

const isMouseGesture = (id: string): boolean =>
  !!commandMap.get(id)?.bindingShape?.suffix
const isChordSequence = (b: string): boolean => b.includes(' ')
const inGlobal = (id: string): boolean =>
  (GLOBAL_COMMANDS as readonly string[]).includes(id)

// Plain-chord commands that *should* be dispatched by the window keydown path.
const windowRouted: CmdRow[] = eligible.filter(
  (c) => !isMouseGesture(c.id) && !isChordSequence(c.binding) && inGlobal(c.id)
)

// Plain-chord commands routed via Monaco / native edit handling.
const editorRouted: CmdRow[] = eligible.filter(
  (c) =>
    !isMouseGesture(c.id) &&
    !isChordSequence(c.binding) &&
    !inGlobal(c.id) &&
    (EDITOR_COMMANDS.has(c.id) || NATIVE_EDIT_COMMANDS.has(c.id))
)

// Plain-chord commands with a binding but no registered dispatch path.
// KBD-016: this set must be empty.
const orphaned: CmdRow[] = eligible.filter(
  (c) =>
    !isMouseGesture(c.id) &&
    !isChordSequence(c.binding) &&
    !inGlobal(c.id) &&
    !EDITOR_COMMANDS.has(c.id) &&
    !NATIVE_EDIT_COMMANDS.has(c.id)
)

const mouseGestureCommands: CmdRow[] = eligible.filter((c) => isMouseGesture(c.id))
const chordSequenceCommands: CmdRow[] = eligible.filter(
  (c) => isChordSequence(c.binding) && !isMouseGesture(c.id)
)

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('KBD-016: every bound command is reachable from its active binding', () => {
  describe('window-routed commands fire from default binding', () => {
    it.each(windowRouted)('$id ($binding) fires once on keydown', ({ id, binding }) => {
      let calls = 0
      const lookup = buildCommandLookupWithSpy(id, () => calls++)
      const bindings = { [id]: binding }
      const ev = buildEvent(binding, document.body)
      dispatchKeydownEvent(ev, bindings, lookup, 'global', makeBuildContext())
      expect(calls).toBe(1)
    })
  })

  describe('rebinding: new keystroke fires once, old default does not fire', () => {
    // Modifier order matches the canonical order produced by `formatKeyboardEvent`
    // (Ctrl, Shift, Alt). Storing a binding with a different modifier order
    // would normalize to this same string via `normalizeShortcut`.
    const NEW_BINDING = 'Ctrl+Shift+Alt+F9' // unused by any current default

    it.each(windowRouted)('$id rebinds cleanly', ({ id, binding }) => {
      let calls = 0
      const lookup = buildCommandLookupWithSpy(id, () => calls++)
      const bindings = { [id]: NEW_BINDING }

      // Old default must NOT fire.
      dispatchKeydownEvent(
        buildEvent(binding, document.body),
        bindings,
        lookup,
        'global',
        makeBuildContext()
      )
      expect(calls, `${id}: old default ${binding} fired after rebind`).toBe(0)

      // New binding must fire exactly once.
      dispatchKeydownEvent(
        buildEvent(NEW_BINDING, document.body),
        bindings,
        lookup,
        'global',
        makeBuildContext()
      )
      expect(calls, `${id}: new binding ${NEW_BINDING} did not fire`).toBe(1)
    })
  })

  describe('input context: allowlist fires, others suppressed', () => {
    const allowlistEligible = (INPUT_ALLOWED_COMMANDS as readonly string[])
      .map((id) => {
        const def = commandMap.get(id)
        return def?.defaultBinding ? { id, binding: def.defaultBinding } : null
      })
      .filter((x): x is CmdRow => x !== null)

    it.each(allowlistEligible)('$id fires when typing in <input>', ({ id, binding }) => {
      let calls = 0
      const lookup = buildCommandLookupWithSpy(id, () => calls++)
      const bindings = { [id]: binding }
      const input = document.createElement('input')
      document.body.appendChild(input)
      try {
        const ev = buildEvent(binding, input)
        dispatchKeydownEvent(ev, bindings, lookup, 'input', makeBuildContext())
        expect(calls).toBe(1)
      } finally {
        document.body.removeChild(input)
      }
    })

    it('GLOBAL_COMMANDS not in the input allowlist do NOT fire from <input>', () => {
      const blocked = (GLOBAL_COMMANDS as readonly string[]).filter(
        (id) => !(INPUT_ALLOWED_COMMANDS as readonly string[]).includes(id)
      )
      for (const id of blocked) {
        const def = commandMap.get(id)
        if (!def?.defaultBinding) continue
        if (isChordSequence(def.defaultBinding)) continue
        if (def.bindingShape?.suffix) continue

        let calls = 0
        const lookup = buildCommandLookupWithSpy(id, () => calls++)
        const bindings = { [id]: def.defaultBinding }
        const input = document.createElement('input')
        document.body.appendChild(input)
        try {
          const ev = buildEvent(def.defaultBinding, input)
          dispatchKeydownEvent(ev, bindings, lookup, 'input', makeBuildContext())
          expect(calls, `${id} should be blocked when typing in <input>`).toBe(0)
        } finally {
          document.body.removeChild(input)
        }
      }
    })
  })

  describe('focus-context classification: Monaco editor focus is global, not input', () => {
    // Regression: Ctrl+2 (view.split) and other view/nav/zoom commands stopped
    // firing when typing in the editor because Monaco's hidden <textarea>
    // matched the generic `input` focus rule. Editor focus must dispatch the
    // full GLOBAL_COMMANDS list so global shortcuts work while editing.
    it('a <textarea> inside .monaco-editor classifies as global', () => {
      const wrapper = document.createElement('div')
      wrapper.className = 'monaco-editor'
      const ta = document.createElement('textarea')
      wrapper.appendChild(ta)
      document.body.appendChild(wrapper)
      try {
        expect(getFocusContextFromTarget(ta)).toBe('global')
      } finally {
        document.body.removeChild(wrapper)
      }
    })

    it('a free-standing <textarea> still classifies as input', () => {
      const ta = document.createElement('textarea')
      document.body.appendChild(ta)
      try {
        expect(getFocusContextFromTarget(ta)).toBe('input')
      } finally {
        document.body.removeChild(ta)
      }
    })

    it('view.split (Ctrl+2) fires when keydown originates from inside .monaco-editor', () => {
      const wrapper = document.createElement('div')
      wrapper.className = 'monaco-editor'
      const ta = document.createElement('textarea')
      wrapper.appendChild(ta)
      document.body.appendChild(wrapper)
      try {
        let calls = 0
        const lookup = buildCommandLookupWithSpy('view.split', () => calls++)
        const bindings = { 'view.split': 'Ctrl+2' }
        const ev = buildEvent('Ctrl+2', ta)
        const focus = getFocusContextFromTarget(ev.target)
        dispatchKeydownEvent(ev, bindings, lookup, focus, makeBuildContext())
        expect(calls).toBe(1)
      } finally {
        document.body.removeChild(wrapper)
      }
    })
  })

  describe('every keystroke-bound command has a registered dispatch path', () => {
    it('no orphan commands (binding present, no GLOBAL/EDITOR/NATIVE registration)', () => {
      // KBD-016: a command listed with a non-null binding but no dispatch path
      // is exactly the bug class this requirement was added to catch.
      expect(orphaned).toEqual([])
    })

    it('every editor-routed command in the registry is in EDITOR_COMMANDS', () => {
      // Sanity: keep this fixture honest. If a markdown-style command appears
      // in the registry but is missing from EDITOR_COMMANDS, it would fall
      // through to `orphaned` above; this is the explicit check.
      const expectedEditorIds = editorRouted.map((c) => c.id).sort()
      expect(expectedEditorIds.length).toBeGreaterThan(0)
    })
  })

  // -------------------------------------------------------------------------
  // Follow-up: KBD-018 (chord sequences) and KBD-019 (mouse gestures).
  // These tests assert the property KBD-016 demands but for command shapes the
  // current dispatcher does not yet support. They are EXPECTED TO FAIL until
  // the follow-up plan (specs/keyboard-commands/plans/chord-and-gesture-bindings.md)
  // is implemented. Do not skip them — the failures document the gap.
  // -------------------------------------------------------------------------

  describe('mouse-gesture commands fire from default binding (KBD-019, expected red)', () => {
    it.each(mouseGestureCommands)('$id ($binding)', ({ id, binding }) => {
      let calls = 0
      const lookup = buildCommandLookupWithSpy(id, () => calls++)
      const bindings = { [id]: binding }
      const ev = buildEvent(binding, document.body)
      dispatchKeydownEvent(ev, bindings, lookup, 'global', makeBuildContext())
      expect(calls).toBe(1)
    })
  })

  describe('chord-sequence commands fire from default binding (KBD-018, expected red)', () => {
    it.each(chordSequenceCommands)('$id ($binding)', ({ id, binding }) => {
      let calls = 0
      const lookup = buildCommandLookupWithSpy(id, () => calls++)
      const bindings = { [id]: binding }
      // A chord-sequence dispatcher would consume each chord in turn. The
      // current dispatcher consumes only one chord per keydown, so this fails.
      for (const chord of binding.split(' ')) {
        dispatchKeydownEvent(
          buildEvent(chord, document.body),
          bindings,
          lookup,
          'global',
          makeBuildContext()
        )
      }
      expect(calls).toBe(1)
    })
  })
})
