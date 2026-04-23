// Traces: WD-002 (canonical spec: specs/window-drag/spec.md)
import { test, expect, waitForAppLoaded } from '../../fixtures'
import {
  getWindowBounds,
  isWindowMaximized,
  maximizeWindow,
  setWindowPosition,
  setWindowSize,
  unmaximizeWindow
} from '../../helpers/window-drag-helpers'

test.describe('WD-002: Alt+Drag From Maximized Unmaximizes, Moves, Then Re-Maximizes', () => {
  test.beforeEach(async ({ electronApp, window }) => {
    await waitForAppLoaded(window)
    // Establish a known unmaximized baseline size/position before maximizing,
    // so unmaximize during drag has sensible restore bounds.
    await unmaximizeWindow(electronApp)
    await setWindowSize(electronApp, 1000, 700)
    await setWindowPosition(electronApp, 120, 120)
    await window.waitForTimeout(150)
    await maximizeWindow(electronApp)
    await window.waitForTimeout(400)
    expect(await isWindowMaximized(electronApp)).toBe(true)
  })

  test('click/tiny movement under 5px threshold does NOT unmaximize', async ({
    electronApp,
    window
  }) => {
    // Alt+down, tiny move (< 5px), release. The window should remain maximized.
    await window.keyboard.down('Alt')
    await window.waitForTimeout(150)
    await window.mouse.move(500, 350)
    await window.mouse.down()
    await window.waitForTimeout(100)

    // Very small jitter, under the 5px threshold
    await window.mouse.move(502, 351)
    await window.mouse.move(503, 352)
    await window.waitForTimeout(100)

    await window.mouse.up()
    await window.keyboard.up('Alt')
    await window.waitForTimeout(300)

    expect(
      await isWindowMaximized(electronApp),
      'window should still be maximized after sub-threshold movement'
    ).toBe(true)
  })

  test('drag exceeding 5px threshold unmaximizes the window to restore normal bounds', async ({
    electronApp,
    window
  }) => {
    const maximizedBounds = await getWindowBounds(electronApp)

    await window.keyboard.down('Alt')
    await window.waitForTimeout(150)
    await window.mouse.move(500, 350)
    await window.mouse.down()
    await window.waitForTimeout(100)

    // Exceed 5px threshold; keep dragging
    for (let i = 1; i <= 10; i++) {
      await window.mouse.move(500 + i * 10, 350 + i * 6)
      if (i % 3 === 0) await window.waitForTimeout(30)
    }
    // Sample bounds mid-drag — should now be non-maximized (smaller) size
    await window.waitForTimeout(200)
    const midBounds = await getWindowBounds(electronApp)
    const midIsMax = await isWindowMaximized(electronApp)

    // Finish the gesture so test state is clean
    await window.mouse.up()
    await window.keyboard.up('Alt')
    await window.waitForTimeout(300)

    expect(midIsMax, 'window should be unmaximized mid-drag').toBe(false)
    expect(
      midBounds.width,
      'mid-drag width should be smaller than maximized width'
    ).toBeLessThan(maximizedBounds.width)
    expect(
      midBounds.height,
      'mid-drag height should be smaller than maximized height'
    ).toBeLessThan(maximizedBounds.height)
  })

  test('re-anchoring avoids phantom offset: window tracks cursor after unmaximize', async ({
    electronApp,
    window
  }) => {
    // After unmaximize, the first mousemove should re-anchor the drag coord system.
    // We verify that after a full drag gesture, the window did NOT jump by a huge
    // phantom offset (~680px) but instead moved by a reasonable amount.
    await window.keyboard.down('Alt')
    await window.waitForTimeout(150)
    await window.mouse.move(500, 350)
    await window.mouse.down()
    await window.waitForTimeout(100)

    const totalDx = 80
    const totalDy = 60
    for (let i = 1; i <= 12; i++) {
      await window.mouse.move(500 + (totalDx * i) / 12, 350 + (totalDy * i) / 12)
      if (i % 3 === 0) await window.waitForTimeout(30)
    }
    await window.waitForTimeout(200)
    const midBounds = await getWindowBounds(electronApp)

    await window.mouse.up()
    await window.keyboard.up('Alt')
    await window.waitForTimeout(300)

    // Mid-drag window x should NOT exhibit a phantom 600+px jump
    expect(
      Math.abs(midBounds.x),
      `mid-drag x (${midBounds.x}) should not be wildly offset by a phantom delta`
    ).toBeLessThan(600)
  })

  test('window is re-maximized on mouseup after drag', async ({ electronApp, window }) => {
    await window.keyboard.down('Alt')
    await window.waitForTimeout(150)
    await window.mouse.move(500, 350)
    await window.mouse.down()
    await window.waitForTimeout(100)

    for (let i = 1; i <= 10; i++) {
      await window.mouse.move(500 + i * 8, 350 + i * 6)
      if (i % 3 === 0) await window.waitForTimeout(30)
    }
    await window.waitForTimeout(200)
    await window.mouse.up()
    await window.keyboard.up('Alt')
    await window.waitForTimeout(500)

    expect(
      await isWindowMaximized(electronApp),
      'window should be re-maximized on mouseup (WD-002 forceMaximize)'
    ).toBe(true)
  })

  test('re-maximize uses force-maximize (stays maximized if already maximized at release)', async ({
    electronApp,
    window
  }) => {
    // Simulate the scenario where WM races and the window re-maximizes before mouseup.
    // After the gesture, force-maximize must not toggle it back off.
    await window.keyboard.down('Alt')
    await window.waitForTimeout(150)
    await window.mouse.move(500, 350)
    await window.mouse.down()
    await window.waitForTimeout(100)

    for (let i = 1; i <= 10; i++) {
      await window.mouse.move(500 + i * 8, 350 + i * 6)
      if (i % 3 === 0) await window.waitForTimeout(30)
    }
    await window.waitForTimeout(200)

    // Force the window back to maximized while mouse is still down,
    // emulating a WM race where it re-maximizes early.
    await electronApp.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
      if (!win.isMaximized()) win.maximize()
    })
    await window.waitForTimeout(150)

    await window.mouse.up()
    await window.keyboard.up('Alt')
    await window.waitForTimeout(500)

    expect(
      await isWindowMaximized(electronApp),
      'force-maximize must not toggle off an already-maximized window'
    ).toBe(true)
  })
})
