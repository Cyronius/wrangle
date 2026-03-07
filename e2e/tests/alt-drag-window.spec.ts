import { test, expect, waitForAppLoaded } from '../fixtures'

/**
 * Helper: Alt+drag from a given point and check window moved
 */
async function altDragAndVerify(
  electronApp: import('@playwright/test').ElectronApplication,
  window: import('@playwright/test').Page,
  startX: number,
  startY: number,
  dragDeltaX: number,
  dragDeltaY: number,
  label: string
) {
  // Get initial window position
  const initialPos = await electronApp.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0]
    const [x, y] = win.getPosition()
    return { x, y }
  })
  console.log(`[${label}] Initial position:`, initialPos)

  // Hold Alt key
  await window.keyboard.down('Alt')
  await window.waitForTimeout(100)

  // Verify overlay appeared
  const overlay = await window.$('.window-drag-overlay')
  expect(overlay, `Overlay should appear for ${label}`).toBeTruthy()

  // Perform the drag
  await window.mouse.move(startX, startY)
  await window.mouse.down()
  await window.waitForTimeout(50) // Let async getPosition resolve

  const steps = 10
  for (let i = 1; i <= steps; i++) {
    await window.mouse.move(
      startX + (dragDeltaX * i) / steps,
      startY + (dragDeltaY * i) / steps
    )
  }
  await window.waitForTimeout(100) // Let IPC messages process

  await window.mouse.up()
  await window.keyboard.up('Alt')

  // Get final window position
  const finalPos = await electronApp.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0]
    const [x, y] = win.getPosition()
    return { x, y }
  })

  const actualDeltaX = finalPos.x - initialPos.x
  const actualDeltaY = finalPos.y - initialPos.y
  console.log(`[${label}] Final position:`, finalPos, `delta:`, { actualDeltaX, actualDeltaY })

  expect(Math.abs(actualDeltaX - dragDeltaX), `${label}: X delta`).toBeLessThan(30)
  expect(Math.abs(actualDeltaY - dragDeltaY), `${label}: Y delta`).toBeLessThan(30)
}

test.describe('Alt+Drag Window Movement', () => {
  test('should move window when Alt+dragging over the editor area', async ({ electronApp, window }) => {
    await waitForAppLoaded(window)

    // Use fixed viewport coordinates (center of window) instead of locating Monaco editor
    await altDragAndVerify(
      electronApp, window,
      400, 300,
      150, 100,
      'editor'
    )
  })

  test('should move window when Alt+dragging over the sidebar', async ({ electronApp, window }) => {
    await waitForAppLoaded(window)

    const sidebarBounds = await window.locator('.sidebar').first().boundingBox()
    expect(sidebarBounds).toBeTruthy()

    await altDragAndVerify(
      electronApp, window,
      sidebarBounds!.x + sidebarBounds!.width / 2,
      sidebarBounds!.y + sidebarBounds!.height / 2,
      -100, 80,
      'sidebar'
    )
  })
})
