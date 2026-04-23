// Traces: WIN-002 (canonical spec: specs/window-lifecycle/spec.md)
import { test, expect } from '../../fixtures'

test.describe('WIN-002: Default Window Size and Minimum', () => {
  test('main window is 1200x800 on initial creation', async ({ electronApp, window }) => {
    await window.waitForLoadState('domcontentloaded')
    const bounds = await electronApp.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0]
      return win ? win.getBounds() : null
    })
    expect(bounds).not.toBeNull()
    expect(bounds!.width).toBe(1200)
    expect(bounds!.height).toBe(800)
  })

  test('minimum size constraint is 400x300', async ({ electronApp, window }) => {
    await window.waitForLoadState('domcontentloaded')
    const minSize = await electronApp.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0]
      return win ? win.getMinimumSize() : null
    })
    expect(minSize).not.toBeNull()
    expect(minSize![0]).toBe(400)
    expect(minSize![1]).toBe(300)
  })

  test('attempting to resize below minimum saturates at the minimum', async ({ electronApp, window }) => {
    await window.waitForLoadState('domcontentloaded')
    const result = await electronApp.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0]
      if (!win) return null
      // Try to shrink to below-min dimensions; Electron should enforce the floor.
      win.setSize(100, 100)
      const b = win.getBounds()
      // Restore
      win.setSize(1200, 800)
      return b
    })
    expect(result).not.toBeNull()
    expect(result!.width).toBeGreaterThanOrEqual(400)
    expect(result!.height).toBeGreaterThanOrEqual(300)
  })
})
