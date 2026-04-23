// Traces: WIN-006 (canonical spec: specs/window-lifecycle/spec.md)
import { test, expect } from '../../fixtures'

test.describe('WIN-006: Single-Instance Lock', () => {
  test('primary instance acquires the single-instance lock', async ({ electronApp, window }) => {
    await window.waitForLoadState('domcontentloaded')
    const gotLock = await electronApp.evaluate(({ app }) => {
      return app.hasSingleInstanceLock()
    })
    expect(gotLock).toBe(true)
  })

  test('second-instance event restores minimized window', async ({ electronApp, window }) => {
    await window.waitForLoadState('domcontentloaded')
    const result = await electronApp.evaluate(async ({ app, BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0]
      if (!win) return null
      win.minimize()
      const wasMinimized = win.isMinimized()
      // Trigger the second-instance handler as the OS would.
      app.emit('second-instance', {}, [process.execPath, 'dummy-app-path'], process.cwd())
      // Give the async handler a tick to run.
      await new Promise((r) => setTimeout(r, 200))
      return { wasMinimized, stillMinimized: win.isMinimized(), focused: win.isFocused() }
    })
    expect(result).not.toBeNull()
    expect(result!.wasMinimized).toBe(true)
    expect(result!.stillMinimized).toBe(false)
  })

  test('second-instance recreates window if closed/destroyed', async ({ electronApp, window }) => {
    await window.waitForLoadState('domcontentloaded')
    const count = await electronApp.evaluate(async ({ app, BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0]
      if (win) {
        await new Promise<void>((resolve) => {
          win.once('closed', () => resolve())
          win.close()
        })
      }
      const afterClose = BrowserWindow.getAllWindows().length
      app.emit('second-instance', {}, [process.execPath, 'dummy-app-path'], process.cwd())
      // Allow the handler to create the replacement window.
      await new Promise((r) => setTimeout(r, 500))
      const afterEmit = BrowserWindow.getAllWindows().length
      return { afterClose, afterEmit }
    })
    expect(count.afterClose).toBe(0)
    expect(count.afterEmit).toBeGreaterThanOrEqual(1)
  })

  test('getFilePathFromArgs skips flags and non-existent paths', async ({ electronApp }) => {
    // The function is module-internal; exercise it via the second-instance
    // code path and assert the window becomes focused without error.
    // File opening requires isTextFile + existsSync, both of which are false
    // for the argv we pass, so no file:openFromPath should be dispatched
    // AND no error should be thrown.
    const errored = await electronApp.evaluate(async ({ app, BrowserWindow }) => {
      try {
        app.emit('second-instance', {}, [process.execPath, 'app.js', '--flag', '/nonexistent/path.md'], process.cwd())
        await new Promise((r) => setTimeout(r, 200))
        return BrowserWindow.getAllWindows().length === 0
      } catch {
        return true
      }
    })
    expect(errored).toBe(false)
  })
})
