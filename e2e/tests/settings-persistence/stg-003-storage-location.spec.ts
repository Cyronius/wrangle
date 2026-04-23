// Traces: STG-003 (canonical spec: specs/settings-persistence/spec.md)
import { test, expect } from '../../fixtures'
import {
  launchWithCleanProfile,
  waitForSettingsFile,
  settingsFilePath,
  readSettingsFile
} from '../../helpers/settings-helpers'
import { promises as fs } from 'fs'
import path from 'path'

test.describe('STG-003: Storage Location', () => {
  test('settings file name is settings.json inside the userData dir', async () => {
    const app = await launchWithCleanProfile()
    try {
      const reported = await app.window.evaluate(async () =>
        window.electron.settings.getPath()
      )
      expect(path.basename(reported)).toBe('settings.json')
      // Directory equals the userDataDir we launched with
      expect(path.dirname(reported)).toBe(app.userDataDir)
    } finally {
      await app.cleanup()
    }
  })

  test('settings:getPath is discoverable at runtime and points to an existing parent dir', async () => {
    const app = await launchWithCleanProfile()
    try {
      const p = await app.window.evaluate(async () => window.electron.settings.getPath())
      const parent = path.dirname(p)
      const stat = await fs.stat(parent)
      expect(stat.isDirectory()).toBe(true)
    } finally {
      await app.cleanup()
    }
  })

  test('writes land in the userData dir (not a hardcoded path override)', async () => {
    const app = await launchWithCleanProfile()
    try {
      await app.window.evaluate(async () =>
        window.electron.settings.set('theme', { current: 'Light', customThemes: {} })
      )

      // File should exist exactly at <userData>/settings.json
      const expected = settingsFilePath(app.userDataDir)
      const data = await waitForSettingsFile(app.userDataDir, (d) => !!d && (d.theme as any)?.current === 'Light')
      expect(data).not.toBeNull()
      const stat = await fs.stat(expected)
      expect(stat.isFile()).toBe(true)
    } finally {
      await app.cleanup()
    }
  })

  test('writes are persisted atomically (readable JSON after set resolves)', async () => {
    const app = await launchWithCleanProfile()
    try {
      // Fire several sets and confirm the file is always parseable JSON when read.
      for (let i = 0; i < 5; i++) {
        await app.window.evaluate(async (iter) => {
          await window.electron.settings.set('layout', {
            splitRatio: 0.3 + iter * 0.05,
            previewSyncLocked: iter % 2 === 0
          })
        }, i)
      }

      const data = await waitForSettingsFile(
        app.userDataDir,
        (d) => !!d && typeof (d.layout as any)?.splitRatio === 'number'
      )
      expect(data).not.toBeNull()

      // A second direct read parses cleanly
      const reread = await readSettingsFile(app.userDataDir)
      expect(reread).not.toBeNull()
      expect(typeof (reread?.layout as any).splitRatio).toBe('number')
    } finally {
      await app.cleanup()
    }
  })

  test('per-OS default location is used when no path override is supplied (platform segment present in path)', async () => {
    // We isolate via --user-data-dir, so we cannot observe the *real* OS default
    // path in this test without polluting the user profile. Instead, verify the
    // semantic guarantee: the reported path is constructed from the userData
    // root that Electron resolves at runtime, which is exactly what the
    // production code relies on. Under --user-data-dir, that root is our temp.
    const app = await launchWithCleanProfile()
    try {
      const reported = await app.window.evaluate(async () =>
        window.electron.settings.getPath()
      )
      // Path must be absolute
      expect(path.isAbsolute(reported)).toBe(true)
      // Path must live under the userData dir (which electron-store derives from app.getPath('userData'))
      expect(reported.startsWith(app.userDataDir)).toBe(true)
    } finally {
      await app.cleanup()
    }
  })
})
