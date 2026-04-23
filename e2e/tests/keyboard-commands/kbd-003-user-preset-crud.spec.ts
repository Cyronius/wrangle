// Traces: KBD-003 (canonical spec: specs/keyboard-commands/spec.md)
import { test } from '../../fixtures'

test.describe('KBD-003: User Preset CRUD', () => {
  test.fixme(
    '"Copy to Custom" creates and activates a new custom preset',
    async () => {
      // Exercising the preset-CRUD modal reliably from an e2e harness requires deeper
      // fixture support (electron-store reset, modal selectors). Unit tests on settingsSlice
      // reducers are the appropriate verification path.
    }
  )

  test.fixme(
    'duplicate preset name shows alert and modal stays open',
    async () => {
      // alert() dialogs + modal lifecycle — better covered in component tests.
    }
  )

  test.fixme(
    'deleting the active custom preset resets currentPreset to default',
    async () => {
      // Redux state transition — unit test.
    }
  )

  test.fixme(
    'custom presets persist via electron-store (1000ms debounce)',
    async () => {
      // Persistence verification requires a relaunch + fixture support for settings path.
    }
  )

  test.fixme(
    'null binding within a custom preset is never dispatched',
    async () => {
      // Requires seeding a custom preset with a null binding; unit test on useKeyboardShortcuts.
    }
  )
})
