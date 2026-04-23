// Traces: WIN-007 (canonical spec: specs/window-lifecycle/spec.md)
import { test, expect } from '../../fixtures'

test.describe('WIN-007: Graceful Shutdown and Running Marker', () => {
  test('running marker exists while the app is running', async ({ electronApp, window }) => {
    await window.waitForLoadState('domcontentloaded')
    const exists = await electronApp.evaluate(() => {
      const os = require('os')
      const path = require('path')
      const fs = require('fs')
      return fs.existsSync(path.join(os.homedir(), '.wrangle', '.running'))
    })
    expect(exists).toBe(true)
  })

  test('will-quit listener is registered on app', async ({ electronApp }) => {
    const hasListener = await electronApp.evaluate(({ app }) => app.listenerCount('will-quit') > 0)
    expect(hasListener).toBe(true)
  })

  test('window-all-closed listener is registered on app', async ({ electronApp }) => {
    const hasListener = await electronApp.evaluate(({ app }) => app.listenerCount('window-all-closed') > 0)
    expect(hasListener).toBe(true)
  })

  test('SIGINT handler is registered on process', async ({ electronApp }) => {
    const has = await electronApp.evaluate(() => process.listenerCount('SIGINT') > 0)
    expect(has).toBe(true)
  })

  test('SIGTERM handler is registered on process', async ({ electronApp }) => {
    const has = await electronApp.evaluate(() => process.listenerCount('SIGTERM') > 0)
    expect(has).toBe(true)
  })

  test('clearRunningMarker swallows errors (shutdown path never blocks)', async ({ electronApp }) => {
    const threw = await electronApp.evaluate(async () => {
      const os = require('os')
      const path = require('path')
      const fs = require('fs')
      const { clearRunningMarker, createRunningMarker } = require(
        path.join(__dirname, 'utils', 'crash-recovery.js')
      )
      const markerPath = path.join(os.homedir(), '.wrangle', '.running')
      // Pre-remove so a second clear hits the missing-file branch.
      if (fs.existsSync(markerPath)) fs.unlinkSync(markerPath)
      let caught = false
      try {
        await clearRunningMarker()
      } catch {
        caught = true
      }
      // Restore so downstream tests / app shutdown are consistent.
      await createRunningMarker()
      return caught
    })
    expect(threw).toBe(false)
  })

  test('will-quit handler unregisters global shortcuts and clears marker', async ({ electronApp }) => {
    // Simulate will-quit by emitting it. The registered handler calls
    // globalShortcut.unregisterAll() synchronously and kicks off the async
    // clearRunningMarker. We assert both completed without throwing.
    const result = await electronApp.evaluate(async ({ app, globalShortcut }) => {
      const os = require('os')
      const path = require('path')
      const fs = require('fs')
      const markerPath = path.join(os.homedir(), '.wrangle', '.running')

      // Register a temp shortcut and confirm registration before emitting.
      const registered = globalShortcut.register('CommandOrControl+Alt+Shift+F9', () => {})
      const wasRegistered = globalShortcut.isRegistered('CommandOrControl+Alt+Shift+F9')

      app.emit('will-quit' as any)
      // Give the async marker-clear a moment.
      await new Promise((r) => setTimeout(r, 200))

      const stillRegistered = globalShortcut.isRegistered('CommandOrControl+Alt+Shift+F9')
      const markerStillPresent = fs.existsSync(markerPath)

      // Restore the marker so the rest of the app is consistent.
      const { createRunningMarker } = require(path.join(__dirname, 'utils', 'crash-recovery.js'))
      await createRunningMarker()

      return { registered, wasRegistered, stillRegistered, markerStillPresent }
    })

    expect(result.registered).toBe(true)
    expect(result.wasRegistered).toBe(true)
    expect(result.stillRegistered).toBe(false)
    expect(result.markerStillPresent).toBe(false)
  })
})
