// Traces: STG-002 (canonical spec: specs/settings-persistence/spec.md)
import { test, expect } from '../../fixtures'
import {
  launchWithCleanProfile,
  waitForSettingsFile,
  settingsFilePath
} from '../../helpers/settings-helpers'

test.describe('STG-002: IPC Contract', () => {
  test('settings:getAll returns the full SettingsSchema object', async () => {
    const app = await launchWithCleanProfile()
    try {
      const all = await app.window.evaluate(async () => window.electron.settings.getAll())
      expect(all).toHaveProperty('theme')
      expect(all).toHaveProperty('shortcuts')
      expect(all).toHaveProperty('layout')
      expect(all).toHaveProperty('editor')
      expect(typeof (all.theme as any).current).toBe('string')
      expect(typeof (all.layout as any).splitRatio).toBe('number')
      expect(typeof (all.editor as any).vimMode).toBe('boolean')
    } finally {
      await app.cleanup()
    }
  })

  test('settings:get returns value at a top-level key', async () => {
    const app = await launchWithCleanProfile()
    try {
      const theme = await app.window.evaluate(async () =>
        window.electron.settings.get('theme')
      )
      expect(theme).toEqual({ current: 'Dark', customThemes: {} })

      const layout = await app.window.evaluate(async () =>
        window.electron.settings.get('layout')
      )
      expect(layout).toEqual({ splitRatio: 0.5, previewSyncLocked: false })
    } finally {
      await app.cleanup()
    }
  })

  test('settings:set writes the key and returns true; persisted to disk', async () => {
    const app = await launchWithCleanProfile()
    try {
      const ok = await app.window.evaluate(async () =>
        window.electron.settings.set('theme', { current: 'Light', customThemes: {} })
      )
      expect(ok).toBe(true)

      const data = await waitForSettingsFile(
        app.userDataDir,
        (d) => !!d && (d.theme as any)?.current === 'Light'
      )
      expect((data?.theme as any).current).toBe('Light')
    } finally {
      await app.cleanup()
    }
  })

  test('settings:setMultiple applies each top-level key independently (shallow merge)', async () => {
    const app = await launchWithCleanProfile()
    try {
      // Seed an existing value on one key we do NOT touch via setMultiple
      await app.window.evaluate(async () =>
        window.electron.settings.set('editor', { vimMode: true })
      )

      const ok = await app.window.evaluate(async () =>
        window.electron.settings.setMultiple({
          theme: { current: 'Light', customThemes: {} },
          layout: { splitRatio: 0.7, previewSyncLocked: true }
        })
      )
      expect(ok).toBe(true)

      const data = await waitForSettingsFile(
        app.userDataDir,
        (d) =>
          !!d &&
          (d.theme as any)?.current === 'Light' &&
          (d.layout as any)?.splitRatio === 0.7
      )
      expect((data?.theme as any).current).toBe('Light')
      expect((data?.layout as any).splitRatio).toBe(0.7)
      expect((data?.layout as any).previewSyncLocked).toBe(true)
      // editor.vimMode must NOT have been clobbered by the partial setMultiple call
      expect((data?.editor as any).vimMode).toBe(true)
    } finally {
      await app.cleanup()
    }
  })

  test('settings:reset clears the store and returns post-reset defaults', async () => {
    const app = await launchWithCleanProfile()
    try {
      await app.window.evaluate(async () =>
        window.electron.settings.setMultiple({
          theme: { current: 'Light', customThemes: { mine: '/* css */' } },
          editor: { vimMode: true }
        })
      )

      const post = await app.window.evaluate(async () => window.electron.settings.reset())

      expect(post).toMatchObject({
        theme: { current: 'Dark', customThemes: {} },
        shortcuts: { currentPreset: 'default', customPresets: {} },
        layout: { splitRatio: 0.5, previewSyncLocked: false },
        editor: { vimMode: false }
      })
    } finally {
      await app.cleanup()
    }
  })

  test('settings:getPath returns the absolute path to settings.json', async () => {
    const app = await launchWithCleanProfile()
    try {
      const returned = await app.window.evaluate(async () =>
        window.electron.settings.getPath()
      )
      expect(typeof returned).toBe('string')
      expect(returned).toBe(settingsFilePath(app.userDataDir))
    } finally {
      await app.cleanup()
    }
  })
})
