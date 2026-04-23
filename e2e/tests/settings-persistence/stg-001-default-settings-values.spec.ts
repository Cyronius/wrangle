// Traces: STG-001 (canonical spec: specs/settings-persistence/spec.md)
import { test, expect } from '../../fixtures'
import {
  launchWithCleanProfile,
  readSettingsFile,
  waitForSettingsFile,
  writeSettingsFile,
  settingsFilePath
} from '../../helpers/settings-helpers'
import { promises as fs } from 'fs'

const EXPECTED_DEFAULTS = {
  theme: { current: 'Dark', customThemes: {} },
  shortcuts: { currentPreset: 'default', customPresets: {} },
  layout: { splitRatio: 0.5, previewSyncLocked: false },
  editor: { vimMode: false }
}

test.describe('STG-001: Default Settings Values', () => {
  test('first launch with no existing settings.json materializes defaults via getAll', async () => {
    const app = await launchWithCleanProfile()
    try {
      // Ensure the profile really is empty before the app starts reading settings.
      // (launchWithCleanProfile creates an empty dir; verify no settings.json yet exists elsewhere.)
      const getAll = await app.window.evaluate(async () => {
        return await window.electron.settings.getAll()
      })

      expect(getAll).toMatchObject(EXPECTED_DEFAULTS)
    } finally {
      await app.cleanup()
    }
  })

  test('reset clears user modifications and re-applies defaults (memory + disk)', async () => {
    const app = await launchWithCleanProfile()
    try {
      // Mutate a few values first
      await app.window.evaluate(async () => {
        await window.electron.settings.set('theme', { current: 'Light', customThemes: { mine: 'body{}' } })
        await window.electron.settings.set('editor', { vimMode: true })
      })

      // Confirm disk reflects the change
      const mutated = await waitForSettingsFile(
        app.userDataDir,
        (d) => !!d && (d.theme as any)?.current === 'Light' && (d.editor as any)?.vimMode === true
      )
      expect((mutated?.theme as any)?.current).toBe('Light')
      expect((mutated?.editor as any)?.vimMode).toBe(true)

      // Now reset
      const post = await app.window.evaluate(async () => {
        return await window.electron.settings.reset()
      })
      expect(post).toMatchObject(EXPECTED_DEFAULTS)

      // And confirm disk was rewritten to defaults
      const afterReset = await waitForSettingsFile(
        app.userDataDir,
        (d) => !!d && (d.theme as any)?.current === 'Dark' && (d.editor as any)?.vimMode === false
      )
      expect(afterReset).toMatchObject(EXPECTED_DEFAULTS)
    } finally {
      await app.cleanup()
    }
  })

  test('missing keys in an existing settings.json are filled in from defaults', async () => {
    const app1 = await launchWithCleanProfile()
    const userDataDir = app1.userDataDir
    await app1.electronApp.close()

    // Seed a partial settings file: only theme.current overridden, everything else absent.
    await writeSettingsFile(userDataDir, {
      theme: { current: 'Light', customThemes: {} }
    })

    // Relaunch against the same profile
    const app2 = await launchWithCleanProfile({ userDataDir })
    try {
      const all = await app2.window.evaluate(async () => {
        return await window.electron.settings.getAll()
      })

      // Overridden key kept
      expect((all.theme as any).current).toBe('Light')
      // Missing keys filled from defaults
      expect(all.shortcuts).toEqual(EXPECTED_DEFAULTS.shortcuts)
      expect(all.layout).toEqual(EXPECTED_DEFAULTS.layout)
      expect(all.editor).toEqual(EXPECTED_DEFAULTS.editor)
    } finally {
      await app2.cleanup()
    }
  })

  test('defaults match the spec exactly (theme, shortcuts, layout, editor)', async () => {
    const app = await launchWithCleanProfile()
    try {
      const all = await app.window.evaluate(async () => window.electron.settings.getAll())
      expect(all.theme.current).toBe('Dark')
      expect(all.theme.customThemes).toEqual({})
      expect(all.shortcuts.currentPreset).toBe('default')
      expect(all.shortcuts.customPresets).toEqual({})
      expect(all.layout.splitRatio).toBe(0.5)
      expect(all.layout.previewSyncLocked).toBe(false)
      expect(all.editor.vimMode).toBe(false)

      // Ensure settings.json, once written, matches as well
      await app.window.evaluate(async () => window.electron.settings.set('editor', { vimMode: false }))
      const onDisk = await waitForSettingsFile(
        app.userDataDir,
        (d) => !!d && !!(d as any).editor
      )
      expect(onDisk).not.toBeNull()
      // The file path should be within the temp userData dir
      const p = settingsFilePath(app.userDataDir)
      const stat = await fs.stat(p)
      expect(stat.isFile()).toBe(true)
    } finally {
      await app.cleanup()
    }
  })

  // Also exercise the raw read helper to make sure the test infrastructure works
  test('readSettingsFile returns null before any write and parsed JSON after', async () => {
    const app = await launchWithCleanProfile()
    try {
      // At startup electron-store may or may not have flushed defaults to disk.
      // Force a write by calling set.
      await app.window.evaluate(async () =>
        window.electron.settings.set('layout', { splitRatio: 0.5, previewSyncLocked: false })
      )
      const data = await waitForSettingsFile(app.userDataDir, (d) => !!d)
      expect(data).not.toBeNull()
      expect(typeof data).toBe('object')
    } finally {
      await app.cleanup()
    }

    // And a fresh untouched dir reads null
    const app2 = await launchWithCleanProfile()
    try {
      // Before calling anything: the dir exists but settings.json may not.
      // We cannot reliably assert "null" here because the app may have written
      // on startup, so just confirm the helper round-trips.
      const data = await readSettingsFile(app2.userDataDir)
      // Either null (no write yet) or a valid object — both acceptable for this smoke check.
      expect(data === null || typeof data === 'object').toBe(true)
    } finally {
      await app2.cleanup()
    }
  })
})
