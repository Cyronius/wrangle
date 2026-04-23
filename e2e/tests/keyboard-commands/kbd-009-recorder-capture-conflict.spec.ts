// Traces: KBD-009 (canonical spec: specs/keyboard-commands/spec.md)
import { test } from '../../fixtures'

test.describe('KBD-009: ShortcutRecorder live capture, Escape cancel, conflict surfacing', () => {
  test.fixme(
    'clicking a recorder enters recording mode and focuses the button',
    async () => {
      // Requires a non-built-in (custom) preset to be active so recorders are enabled.
      // Preset creation is fixme under KBD-003; this test follows.
    }
  )

  test.fixme(
    'modifier-only keypresses (Shift/Alt/Ctrl/Meta) are ignored while recording',
    async () => {
      // Same prerequisite as above.
    }
  )

  test.fixme(
    'Escape cancels recording without changing the binding',
    async () => {
      // Same prerequisite.
    }
  )

  test.fixme(
    'valid keypress commits onChange and exits recording',
    async () => {
      // Same prerequisite.
    }
  )

  test.fixme(
    'clicking outside the recorder cancels recording',
    async () => {
      // Same prerequisite.
    }
  )

  test.fixme(
    'conflicts with existing bindings are surfaced with conflict CSS modifier',
    async () => {
      // Requires seeding a preset with two commands sharing a binding and asserting DOM class.
      // Component test is the right granularity.
    }
  )
})
