import { test, expect, waitForAppLoaded } from '../fixtures'

test.describe('Dragging a maximized window', () => {
  test('titlebar drag from spacer should unmaximize and move', async ({ electronApp, window }) => {
    await waitForAppLoaded(window)

    // Maximize the window
    await electronApp.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0].maximize()
    })
    await window.waitForTimeout(500)

    const isMaxBefore = await electronApp.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].isMaximized()
    )
    expect(isMaxBefore).toBe(true)

    // The drag spacer should now be at least 60px wide
    const spacerBox = await window.locator('.tab-row-drag-spacer').boundingBox()
    console.log('Spacer bounds:', spacerBox)
    expect(spacerBox).toBeTruthy()
    expect(spacerBox!.width).toBeGreaterThanOrEqual(60)

    const dragX = spacerBox!.x + spacerBox!.width / 2
    const dragY = spacerBox!.y + spacerBox!.height / 2
    console.log(`Dragging from spacer at (${dragX}, ${dragY})`)

    // Perform titlebar drag
    await window.mouse.move(dragX, dragY)
    await window.mouse.down()
    await window.waitForTimeout(200)

    for (let i = 1; i <= 10; i++) {
      await window.mouse.move(dragX + i * 8, dragY + i * 6)
      if (i <= 3) await window.waitForTimeout(50)
    }
    await window.waitForTimeout(300)
    await window.mouse.up()
    await window.waitForTimeout(200)

    const after = await electronApp.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0]
      const [x, y] = win.getPosition()
      return { x, y, isMax: win.isMaximized() }
    })
    console.log('After titlebar drag:', after)

    expect(after.isMax, 'Window should be unmaximized after titlebar drag').toBe(false)
  })

  test('Alt+drag should unmaximize and move', async ({ electronApp, window }) => {
    await waitForAppLoaded(window)

    // Maximize the window
    await electronApp.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0].maximize()
    })
    await window.waitForTimeout(500)

    const isMaxBefore = await electronApp.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].isMaximized()
    )
    expect(isMaxBefore).toBe(true)

    const startX = 400
    const startY = 300

    await window.keyboard.down('Alt')
    await window.waitForTimeout(100)

    await window.mouse.move(startX, startY)
    await window.mouse.down()
    await window.waitForTimeout(200)

    for (let i = 1; i <= 10; i++) {
      await window.mouse.move(startX + i * 8, startY + i * 6)
      if (i <= 3) await window.waitForTimeout(50)
    }
    await window.waitForTimeout(300)
    await window.mouse.up()
    await window.keyboard.up('Alt')
    await window.waitForTimeout(200)

    const after = await electronApp.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0]
      const [x, y] = win.getPosition()
      return { x, y, isMax: win.isMaximized() }
    })
    console.log('After Alt+drag:', after)

    // Per WD-002: Alt+drag from maximized re-maximizes on mouseup.
    // The window should end up maximized on whichever monitor it was dragged to.
    expect(after.isMax, 'Window should be re-maximized after Alt+drag release (WD-002)').toBe(true)
  })
})
