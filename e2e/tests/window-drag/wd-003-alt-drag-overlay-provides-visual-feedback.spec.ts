// Traces: WD-003 (canonical spec: specs/window-drag/spec.md)
import { test, expect, waitForAppLoaded } from '../../fixtures'
import {
  getWindowPosition,
  setWindowPosition,
  setWindowSize,
  unmaximizeWindow
} from '../../helpers/window-drag-helpers'

test.describe('WD-003: Alt+Drag Overlay Provides Visual Feedback', () => {
  test.beforeEach(async ({ electronApp, window }) => {
    await waitForAppLoaded(window)
    await unmaximizeWindow(electronApp)
    await setWindowSize(electronApp, 1000, 700)
    await setWindowPosition(electronApp, 120, 120)
    await window.waitForTimeout(150)
  })

  test('overlay appears immediately when Alt is pressed', async ({ window }) => {
    // No overlay initially
    expect(await window.$('.window-drag-overlay')).toBeNull()

    await window.keyboard.down('Alt')
    await window.waitForTimeout(200)

    const overlay = await window.$('.window-drag-overlay')
    expect(overlay, 'overlay element should be present when Alt is held').toBeTruthy()

    await window.keyboard.up('Alt')
    await window.waitForTimeout(200)
  })

  test('overlay disappears when Alt is released', async ({ window }) => {
    await window.keyboard.down('Alt')
    await window.waitForTimeout(200)
    expect(await window.$('.window-drag-overlay')).toBeTruthy()

    await window.keyboard.up('Alt')
    await window.waitForTimeout(200)

    expect(
      await window.$('.window-drag-overlay'),
      'overlay should be gone after Alt released'
    ).toBeNull()
  })

  test('overlay has z-index 99999 to sit above all other content', async ({ window }) => {
    await window.keyboard.down('Alt')
    await window.waitForTimeout(200)

    const zIndex = await window.evaluate(() => {
      const el = document.querySelector('.window-drag-overlay') as HTMLElement | null
      if (!el) return null
      return getComputedStyle(el).zIndex
    })

    await window.keyboard.up('Alt')
    await window.waitForTimeout(150)

    expect(zIndex).toBe('99999')
  })

  test('overlay uses cursor: grab to indicate draggability', async ({ window }) => {
    await window.keyboard.down('Alt')
    await window.waitForTimeout(200)

    const cursor = await window.evaluate(() => {
      const el = document.querySelector('.window-drag-overlay') as HTMLElement | null
      if (!el) return null
      return getComputedStyle(el).cursor
    })

    await window.keyboard.up('Alt')
    await window.waitForTimeout(150)

    expect(cursor).toBe('grab')
  })

  test('overlay uses position: fixed with inset: 0 (covers the entire window)', async ({
    window
  }) => {
    await window.keyboard.down('Alt')
    await window.waitForTimeout(200)

    const box = await window.evaluate(() => {
      const el = document.querySelector('.window-drag-overlay') as HTMLElement | null
      if (!el) return null
      const cs = getComputedStyle(el)
      const rect = el.getBoundingClientRect()
      return {
        position: cs.position,
        top: cs.top,
        left: cs.left,
        right: cs.right,
        bottom: cs.bottom,
        width: rect.width,
        height: rect.height,
        viewportW: window.innerWidth,
        viewportH: window.innerHeight
      }
    })

    await window.keyboard.up('Alt')
    await window.waitForTimeout(150)

    expect(box, 'overlay must exist while Alt held').not.toBeNull()
    expect(box!.position).toBe('fixed')
    // inset: 0 resolves to 0px on all sides
    expect(box!.top).toBe('0px')
    expect(box!.left).toBe('0px')
    expect(box!.right).toBe('0px')
    expect(box!.bottom).toBe('0px')
    // Covers the full viewport
    expect(Math.abs(box!.width - box!.viewportW)).toBeLessThan(2)
    expect(Math.abs(box!.height - box!.viewportH)).toBeLessThan(2)
  })

  test('overlay does not interfere with the drag IPC mechanism (window still moves)', async ({
    electronApp,
    window
  }) => {
    const before = await getWindowPosition(electronApp)

    await window.keyboard.down('Alt')
    await window.waitForTimeout(200)

    // Confirm overlay is present at the moment the drag begins
    expect(await window.$('.window-drag-overlay')).toBeTruthy()

    await window.mouse.move(500, 350)
    await window.mouse.down()
    await window.waitForTimeout(100)
    for (let i = 1; i <= 10; i++) {
      await window.mouse.move(500 + i * 10, 350 + i * 8)
      if (i % 3 === 0) await window.waitForTimeout(30)
    }
    await window.waitForTimeout(150)
    await window.mouse.up()
    await window.keyboard.up('Alt')
    await window.waitForTimeout(250)

    const after = await getWindowPosition(electronApp)
    expect(Math.abs(after.x - before.x - 100), 'window moved despite overlay').toBeLessThan(40)
    expect(Math.abs(after.y - before.y - 80), 'window moved despite overlay').toBeLessThan(40)
  })
})
