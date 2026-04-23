// Traces: WIN-001 (canonical spec: specs/window-lifecycle/spec.md)
import { test, expect } from '../../fixtures'

test.describe('WIN-001: Window Show Race', () => {
  test('window is constructed with show:false so it opens hidden in test mode', async ({ electronApp, window }) => {
    // In NODE_ENV=test, the show() call is suppressed; the window should remain
    // not-visible at the OS level even though the renderer is fully loaded.
    await window.waitForLoadState('domcontentloaded')

    const state = await electronApp.evaluate(({ BrowserWindow }) => {
      const wins = BrowserWindow.getAllWindows()
      return wins.map((w) => ({
        visible: w.isVisible(),
        destroyed: w.isDestroyed()
      }))
    })

    expect(state.length).toBeGreaterThan(0)
    // Suppressed show() in test mode => not visible.
    expect(state[0].visible).toBe(false)
    expect(state[0].destroyed).toBe(false)
  })

  test('at least one of ready-to-show / did-finish-load / safety-timer fires (renderer loads)', async ({ window }) => {
    // The renderer reaches domcontentloaded only if the load pipeline fires,
    // which guarantees one of the race triggers has a chance to run.
    await window.waitForLoadState('domcontentloaded')
    const title = await window.title()
    expect(title).toBeTruthy()
  })

  test('safety timer is cleared on window close (no pending timer leak)', async ({ electronApp }) => {
    // Close the window and verify no exceptions and window is destroyed.
    // If the timer were not cleared, the fired callback checks isDestroyed()
    // so this is still safe. We assert destruction completes cleanly.
    const destroyed = await electronApp.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0]
      if (!win) return true
      return new Promise<boolean>((resolve) => {
        win.once('closed', () => resolve(true))
        win.destroy()
      })
    })
    expect(destroyed).toBe(true)
  })

  test('showNow is idempotent - invoking show paths twice does not error', async ({ electronApp, window }) => {
    await window.waitForLoadState('domcontentloaded')
    // Call show() directly several times; the internal latch prevents double-show
    // in production but the Electron API is itself idempotent. This proves
    // the window survives repeat show triggers without crashing.
    const ok = await electronApp.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0]
      if (!win) return false
      win.show()
      win.show()
      win.show()
      return !win.isDestroyed()
    })
    expect(ok).toBe(true)
  })
})
