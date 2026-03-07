import { test, expect, waitForAppLoaded } from '../fixtures'
import { ElectronApplication, Page } from '@playwright/test'

/**
 * E2E tests for window drag requirements WD-001, WD-002, WD-003.
 *
 * These tests validate:
 * - WD-001: Alt+drag moves a non-maximized window
 * - WD-002: Alt+drag from maximized unmaximizes, moves, re-maximizes on release
 * - WD-003: Alt key shows/hides the drag overlay
 */

// --- Helpers ---

async function getWindowPosition(electronApp: ElectronApplication): Promise<{ x: number; y: number }> {
  return electronApp.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0]
    const [x, y] = win.getPosition()
    return { x, y }
  })
}

async function getWindowSize(electronApp: ElectronApplication): Promise<{ width: number; height: number }> {
  return electronApp.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0]
    const [width, height] = win.getSize()
    return { width, height }
  })
}

async function isWindowMaximized(electronApp: ElectronApplication): Promise<boolean> {
  return electronApp.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0]
    return win.isMaximized()
  })
}

async function maximizeWindow(electronApp: ElectronApplication): Promise<void> {
  await electronApp.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0]
    if (!win.isMaximized()) {
      win.maximize()
    }
  })
}

async function unmaximizeWindow(electronApp: ElectronApplication): Promise<void> {
  await electronApp.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0]
    if (win.isMaximized()) {
      win.unmaximize()
    }
  })
}

async function setWindowPosition(electronApp: ElectronApplication, x: number, y: number): Promise<void> {
  await electronApp.evaluate(({ BrowserWindow }, pos) => {
    const win = BrowserWindow.getAllWindows()[0]
    win.setPosition(pos.x, pos.y)
  }, { x, y })
}

async function setWindowSize(electronApp: ElectronApplication, w: number, h: number): Promise<void> {
  await electronApp.evaluate(({ BrowserWindow }, size) => {
    const win = BrowserWindow.getAllWindows()[0]
    win.setSize(size.w, size.h)
  }, { w, h })
}

/**
 * Perform an Alt+drag gesture on the page.
 * Coordinates are page-relative (viewport).
 */
async function altDrag(
  window: Page,
  startX: number,
  startY: number,
  deltaX: number,
  deltaY: number,
  options?: { steps?: number; releaseAlt?: boolean }
): Promise<void> {
  const steps = options?.steps ?? 10
  const releaseAlt = options?.releaseAlt ?? true

  // Press Alt
  await window.keyboard.down('Alt')
  await window.waitForTimeout(150) // Allow React state update + re-render

  // Move to start position and press mouse button
  await window.mouse.move(startX, startY)
  await window.mouse.down()
  await window.waitForTimeout(100) // Allow async IPC (getPosition/isMaximized)

  // Drag in steps
  for (let i = 1; i <= steps; i++) {
    await window.mouse.move(
      startX + (deltaX * i) / steps,
      startY + (deltaY * i) / steps
    )
    // Small delay to let IPC messages process
    if (i % 3 === 0) {
      await window.waitForTimeout(30)
    }
  }
  await window.waitForTimeout(100)

  // Release mouse
  await window.mouse.up()
  await window.waitForTimeout(100)

  // Release Alt
  if (releaseAlt) {
    await window.keyboard.up('Alt')
    await window.waitForTimeout(100)
  }
}


// --- WD-003 Tests: Drag Overlay ---

test.describe('WD-003: Alt+Drag Overlay', () => {
  test('WD-003: overlay appears when Alt is pressed and disappears when released', async ({ window }) => {
    await waitForAppLoaded(window)

    // No overlay initially
    let overlay = await window.$('.window-drag-overlay')
    expect(overlay).toBeNull()

    // Press Alt -> overlay should appear
    await window.keyboard.down('Alt')
    await window.waitForTimeout(200)
    overlay = await window.$('.window-drag-overlay')
    expect(overlay, 'Overlay should appear when Alt is held').toBeTruthy()

    // Release Alt -> overlay should disappear
    await window.keyboard.up('Alt')
    await window.waitForTimeout(200)
    overlay = await window.$('.window-drag-overlay')
    expect(overlay, 'Overlay should disappear when Alt is released').toBeNull()
  })
})


// --- WD-001 Tests: Non-Maximized Window Drag ---

test.describe('WD-001: Alt+Drag Moves Non-Maximized Window', () => {
  test.beforeEach(async ({ electronApp, window }) => {
    await waitForAppLoaded(window)
    // Ensure window is NOT maximized and at a known position/size
    await unmaximizeWindow(electronApp)
    await setWindowSize(electronApp, 1000, 700)
    await setWindowPosition(electronApp, 100, 100)
    await window.waitForTimeout(200)
  })

  test('WD-001: window moves by the drag delta', async ({ electronApp, window }) => {
    const posBefore = await getWindowPosition(electronApp)
    console.log('WD-001: position before drag:', posBefore)

    // Alt+drag from center of viewport
    await altDrag(window, 500, 350, 120, 80)

    const posAfter = await getWindowPosition(electronApp)
    console.log('WD-001: position after drag:', posAfter)

    const actualDx = posAfter.x - posBefore.x
    const actualDy = posAfter.y - posBefore.y

    // Allow tolerance for IPC timing
    expect(Math.abs(actualDx - 120), `X delta: expected ~120, got ${actualDx}`).toBeLessThan(40)
    expect(Math.abs(actualDy - 80), `Y delta: expected ~80, got ${actualDy}`).toBeLessThan(40)
  })

  test('WD-001: window stays non-maximized after drag', async ({ electronApp, window }) => {
    await altDrag(window, 500, 350, 100, 50)

    const isMax = await isWindowMaximized(electronApp)
    expect(isMax, 'Window should remain non-maximized after alt+drag').toBe(false)
  })

  test('WD-001: drag works over the editor area', async ({ electronApp, window }) => {
    // Use fixed viewport coordinates (center of window) instead of locating Monaco editor
    const posBefore = await getWindowPosition(electronApp)

    await altDrag(
      window,
      400, 300,
      80, 60
    )

    const posAfter = await getWindowPosition(electronApp)
    const actualDx = posAfter.x - posBefore.x
    const actualDy = posAfter.y - posBefore.y

    expect(Math.abs(actualDx - 80), `Editor drag X: expected ~80, got ${actualDx}`).toBeLessThan(40)
    expect(Math.abs(actualDy - 60), `Editor drag Y: expected ~60, got ${actualDy}`).toBeLessThan(40)
  })

  test('WD-001: drag works over the sidebar', async ({ electronApp, window }) => {
    const sidebar = await window.locator('.sidebar').first().boundingBox()
    if (!sidebar) {
      test.skip()
      return
    }

    const posBefore = await getWindowPosition(electronApp)

    await altDrag(
      window,
      sidebar.x + sidebar.width / 2,
      sidebar.y + sidebar.height / 2,
      -60, 40
    )

    const posAfter = await getWindowPosition(electronApp)
    const actualDx = posAfter.x - posBefore.x

    expect(Math.abs(actualDx - (-60)), `Sidebar drag X: expected ~-60, got ${actualDx}`).toBeLessThan(40)
  })
})


// --- WD-002 Tests: Maximized Window Alt+Drag ---

test.describe('WD-002: Alt+Drag From Maximized Window', () => {
  test.beforeEach(async ({ electronApp, window }) => {
    await waitForAppLoaded(window)
    // Maximize the window
    await maximizeWindow(electronApp)
    await window.waitForTimeout(300)
    const isMax = await isWindowMaximized(electronApp)
    expect(isMax, 'Window should be maximized for WD-002 tests').toBe(true)
  })

  test('WD-002: alt+drag unmaximizes the window during drag', async ({ electronApp, window }) => {
    // Confirm maximized
    expect(await isWindowMaximized(electronApp)).toBe(true)

    // Press Alt, start a drag that exceeds the 5px threshold
    await window.keyboard.down('Alt')
    await window.waitForTimeout(150)
    await window.mouse.move(500, 350)
    await window.mouse.down()
    await window.waitForTimeout(100)

    // Drag past the threshold
    for (let i = 1; i <= 15; i++) {
      await window.mouse.move(500 + i * 5, 350 + i * 3)
      if (i % 5 === 0) await window.waitForTimeout(50)
    }
    await window.waitForTimeout(200)

    // During drag, window should be unmaximized (it was restored for dragging)
    const isMaxDuring = await isWindowMaximized(electronApp)
    expect(isMaxDuring, 'Window should be unmaximized during the drag').toBe(false)

    // Clean up
    await window.mouse.up()
    await window.waitForTimeout(200)
    await window.keyboard.up('Alt')
  })

  test('WD-002: window re-maximizes after alt+drag release', async ({ electronApp, window }) => {
    expect(await isWindowMaximized(electronApp)).toBe(true)

    // Perform alt+drag that exceeds threshold
    await altDrag(window, 500, 350, 80, 40)

    // Wait for re-maximize to take effect
    await window.waitForTimeout(500)

    const isMaxAfter = await isWindowMaximized(electronApp)
    expect(isMaxAfter, 'Window should be re-maximized after alt+drag release').toBe(true)
  })

  test('WD-002: re-maximizes on mouseup even after blur during drag', async ({ electronApp, window }) => {
    // Simulates what Linux WMs do: fire blur during window reposition.
    // The drag may lose its event stream, but mouseup should still re-maximize.
    expect(await isWindowMaximized(electronApp)).toBe(true)

    // Start the alt+drag
    await window.keyboard.down('Alt')
    await window.waitForTimeout(150)
    await window.mouse.move(500, 350)
    await window.mouse.down()
    await window.waitForTimeout(100)

    // Drag past threshold to trigger unmaximize
    for (let i = 1; i <= 10; i++) {
      await window.mouse.move(500 + i * 5, 350 + i * 3)
    }
    await window.waitForTimeout(300)

    // Window should be unmaximized now
    expect(await isWindowMaximized(electronApp)).toBe(false)

    // Fire a blur event (simulates WM transient blur during reposition)
    await window.evaluate(() => window.dispatchEvent(new Event('blur')))
    await window.waitForTimeout(100)

    // Release mouse — should still re-maximize despite the blur
    await window.mouse.up()
    await window.waitForTimeout(500)
    await window.keyboard.up('Alt')

    const isMaxAfter = await isWindowMaximized(electronApp)
    expect(isMaxAfter, 'Window should re-maximize after drag despite blur').toBe(true)
  })

  test('WD-002: re-maximizes on mouseup even after Alt keyup during drag', async ({ electronApp, window }) => {
    // Some WMs replay Alt keyup during window state changes.
    // The drag should survive and re-maximize on mouseup.
    expect(await isWindowMaximized(electronApp)).toBe(true)

    await window.keyboard.down('Alt')
    await window.waitForTimeout(150)
    await window.mouse.move(500, 350)
    await window.mouse.down()
    await window.waitForTimeout(100)

    // Drag past threshold
    for (let i = 1; i <= 10; i++) {
      await window.mouse.move(500 + i * 5, 350 + i * 3)
    }
    await window.waitForTimeout(300)

    // Window should be unmaximized
    expect(await isWindowMaximized(electronApp)).toBe(false)

    // Release Alt while still dragging (simulates WM eating the key)
    await window.keyboard.up('Alt')
    await window.waitForTimeout(100)

    // Release mouse — should still re-maximize
    await window.mouse.up()
    await window.waitForTimeout(500)

    const isMaxAfter = await isWindowMaximized(electronApp)
    expect(isMaxAfter, 'Window should re-maximize after drag despite Alt keyup').toBe(true)
  })

  test('WD-002: small movement below threshold does not unmaximize', async ({ electronApp, window }) => {
    expect(await isWindowMaximized(electronApp)).toBe(true)

    // Alt+click with tiny movement (below 5px threshold)
    await window.keyboard.down('Alt')
    await window.waitForTimeout(150)
    await window.mouse.move(500, 350)
    await window.mouse.down()
    await window.waitForTimeout(100)
    // Move only 2px - below threshold
    await window.mouse.move(502, 351)
    await window.waitForTimeout(100)
    await window.mouse.up()
    await window.keyboard.up('Alt')
    await window.waitForTimeout(200)

    const isMax = await isWindowMaximized(electronApp)
    expect(isMax, 'Window should stay maximized when drag is below threshold').toBe(true)
  })
})
