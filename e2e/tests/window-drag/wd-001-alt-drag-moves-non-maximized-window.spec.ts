// Traces: WD-001 (canonical spec: specs/window-drag/spec.md)
import { test, expect, waitForAppLoaded } from '../../fixtures'
import {
  altDrag,
  getWindowBounds,
  getWindowPosition,
  isWindowMaximized,
  setWindowPosition,
  setWindowSize,
  unmaximizeWindow
} from '../../helpers/window-drag-helpers'

test.describe('WD-001: Alt+Drag Moves Non-Maximized Window', () => {
  test.beforeEach(async ({ electronApp, window }) => {
    await waitForAppLoaded(window)
    await unmaximizeWindow(electronApp)
    await setWindowSize(electronApp, 1000, 700)
    await setWindowPosition(electronApp, 120, 120)
    await window.waitForTimeout(200)
  })

  test('Alt held before mousedown initiates drag and moves window by delta', async ({
    electronApp,
    window
  }) => {
    const before = await getWindowPosition(electronApp)

    // Alt is pressed first inside altDrag(), before mousedown.
    await altDrag(window, 500, 350, 120, 80)

    const after = await getWindowPosition(electronApp)
    const dx = after.x - before.x
    const dy = after.y - before.y

    expect(Math.abs(dx - 120), `expected ~120 X delta, got ${dx}`).toBeLessThan(40)
    expect(Math.abs(dy - 80), `expected ~80 Y delta, got ${dy}`).toBeLessThan(40)
  })

  test('left mouse button initiates drag (right-click does not move window)', async ({
    electronApp,
    window
  }) => {
    const before = await getWindowPosition(electronApp)

    await window.keyboard.down('Alt')
    await window.waitForTimeout(150)

    // Right-click drag should NOT move the window.
    await window.mouse.move(500, 350)
    await window.mouse.down({ button: 'right' })
    await window.waitForTimeout(100)
    for (let i = 1; i <= 10; i++) {
      await window.mouse.move(500 + i * 10, 350 + i * 8)
    }
    await window.waitForTimeout(150)
    await window.mouse.up({ button: 'right' })
    await window.keyboard.up('Alt')
    await window.waitForTimeout(150)

    const after = await getWindowPosition(electronApp)
    expect(Math.abs(after.x - before.x)).toBeLessThan(10)
    expect(Math.abs(after.y - before.y)).toBeLessThan(10)
  })

  test('window position updates continuously during the drag (intermediate sample moves)', async ({
    electronApp,
    window
  }) => {
    const before = await getWindowPosition(electronApp)

    const startX = 500
    const startY = 350

    await window.keyboard.down('Alt')
    await window.waitForTimeout(150)
    await window.mouse.move(startX, startY)
    await window.mouse.down()
    await window.waitForTimeout(100)

    // Move halfway and sample position
    for (let i = 1; i <= 5; i++) {
      await window.mouse.move(startX + i * 20, startY + i * 10)
    }
    await window.waitForTimeout(150)
    const midway = await getWindowPosition(electronApp)

    // Continue the drag the rest of the way
    for (let i = 6; i <= 10; i++) {
      await window.mouse.move(startX + i * 20, startY + i * 10)
    }
    await window.waitForTimeout(150)
    await window.mouse.up()
    await window.keyboard.up('Alt')
    await window.waitForTimeout(150)

    const after = await getWindowPosition(electronApp)

    // Window should have progressed partway at the midpoint sample
    expect(midway.x - before.x, 'mid-drag X should have progressed').toBeGreaterThan(20)
    // And moved further by the end
    expect(after.x - before.x, 'final X delta should exceed mid-drag').toBeGreaterThan(
      midway.x - before.x - 5
    )
  })

  test('window stays at released position on mouseup (no snap-back, no maximize)', async ({
    electronApp,
    window
  }) => {
    const before = await getWindowPosition(electronApp)

    await altDrag(window, 500, 350, 100, 60)
    await window.waitForTimeout(300)

    const afterRelease = await getWindowPosition(electronApp)
    const isMax = await isWindowMaximized(electronApp)

    expect(isMax, 'window must not be maximized after alt+drag release').toBe(false)
    expect(afterRelease.x, 'no X snap-back').not.toBe(before.x)
    expect(afterRelease.y, 'no Y snap-back').not.toBe(before.y)

    // Wait an extra moment; still should not snap back.
    await window.waitForTimeout(400)
    const later = await getWindowPosition(electronApp)
    expect(Math.abs(later.x - afterRelease.x)).toBeLessThan(5)
    expect(Math.abs(later.y - afterRelease.y)).toBeLessThan(5)
  })

  test('drag works regardless of which UI element the cursor is over (sidebar)', async ({
    electronApp,
    window
  }) => {
    const before = await getWindowPosition(electronApp)

    const sidebar = await window.locator('.sidebar').first().boundingBox()
    expect(sidebar, 'sidebar should be visible').toBeTruthy()

    const startX = sidebar!.x + sidebar!.width / 2
    const startY = sidebar!.y + sidebar!.height / 2

    await altDrag(window, startX, startY, -80, 60)

    const after = await getWindowPosition(electronApp)
    expect(Math.abs(after.x - before.x - -80), `X delta from sidebar drag`).toBeLessThan(40)
    expect(Math.abs(after.y - before.y - 60), `Y delta from sidebar drag`).toBeLessThan(40)
  })

  test('drag works regardless of which UI element the cursor is over (editor area center)', async ({
    electronApp,
    window
  }) => {
    const before = await getWindowBounds(electronApp)

    // Center of the viewport — typically editor area
    await altDrag(window, 700, 400, 90, 70)

    const after = await getWindowBounds(electronApp)
    expect(Math.abs(after.x - before.x - 90)).toBeLessThan(40)
    expect(Math.abs(after.y - before.y - 70)).toBeLessThan(40)
    // Size unchanged
    expect(after.width).toBe(before.width)
    expect(after.height).toBe(before.height)
  })
})
