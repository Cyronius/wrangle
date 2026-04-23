// Traces: KBD-010 (canonical spec: specs/keyboard-commands/spec.md)
import { test } from '../../fixtures'

test.describe('KBD-010: Reset-command and reset-preset to defaults', () => {
  test.fixme(
    'reset-command restores a single command to its registry defaultBinding',
    async () => {
      // Requires active custom preset + a mutated binding; preset CRUD is fixme under KBD-003.
    }
  )

  test.fixme(
    'reset-command with null defaultBinding leaves the command unbound',
    async () => {
      // Same prerequisite as above.
    }
  )

  test.fixme(
    'reset-preset replaces all bindings with a fresh copy of builtInPresets.default',
    async () => {
      // Requires Redux state assertion pre/post reset; unit test is the right granularity.
    }
  )

  test.fixme(
    'reset actions are disabled when the active preset is built-in',
    async () => {
      // UI-state assertion on disabled/hidden controls; component test is better suited.
    }
  )

  test.fixme(
    'reset persists within 1000ms via debounced saveShortcutSettings',
    async () => {
      // Requires observing electron-store writes — integration test.
    }
  )

  test.fixme(
    'clearing via the × button sets binding to null (not a reset)',
    async () => {
      // Same component-test rationale.
    }
  )
})
