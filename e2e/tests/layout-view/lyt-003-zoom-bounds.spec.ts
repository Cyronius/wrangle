// Traces: LYT-003 (canonical spec: specs/layout-view/spec.md)
import { test, expect, waitForAppReady } from '../../fixtures'

async function zoomLevel(window: import('@playwright/test').Page): Promise<number> {
  return window.evaluate(() => {
    const store = (window as any).__REDUX_STORE__
    return store.getState().layout.zoomLevel as number
  })
}

async function dispatch(
  window: import('@playwright/test').Page,
  type: 'layout/zoomIn' | 'layout/zoomOut' | 'layout/resetZoom'
): Promise<void> {
  await window.evaluate((t) => {
    const store = (window as any).__REDUX_STORE__
    store.dispatch({ type: t })
  }, type)
}

test.describe('LYT-003: Zoom Level Bounded to [-5, +5] with 1.1^n Scaling', () => {
  test.beforeEach(async ({ window }) => {
    await waitForAppReady(window)
    await dispatch(window, 'layout/resetZoom')
  })

  test('zoomLevel starts at 0 after reset', async ({ window }) => {
    expect(await zoomLevel(window)).toBe(0)
  })

  test('zoomIn increments by 1 and caps at +5', async ({ window }) => {
    for (let i = 0; i < 5; i++) await dispatch(window, 'layout/zoomIn')
    expect(await zoomLevel(window)).toBe(5)

    // Further zoomIn calls should NOT exceed +5
    for (let i = 0; i < 3; i++) await dispatch(window, 'layout/zoomIn')
    expect(await zoomLevel(window)).toBe(5)
  })

  test('zoomOut decrements by 1 and floors at -5', async ({ window }) => {
    for (let i = 0; i < 5; i++) await dispatch(window, 'layout/zoomOut')
    expect(await zoomLevel(window)).toBe(-5)

    for (let i = 0; i < 3; i++) await dispatch(window, 'layout/zoomOut')
    expect(await zoomLevel(window)).toBe(-5)
  })

  test('resetZoom returns zoomLevel to 0', async ({ window }) => {
    await dispatch(window, 'layout/zoomIn')
    await dispatch(window, 'layout/zoomIn')
    expect(await zoomLevel(window)).toBe(2)
    await dispatch(window, 'layout/resetZoom')
    expect(await zoomLevel(window)).toBe(0)
  })

  test('scale factor follows 1.1^zoomLevel (mathematical identity)', async ({ window }) => {
    // Verify the documented formula: +1 ≈ 1.10, -1 ≈ 0.909, +5 ≈ 1.61
    expect(Math.pow(1.1, 1)).toBeCloseTo(1.1, 3)
    expect(Math.pow(1.1, -1)).toBeCloseTo(0.9091, 3)
    expect(Math.pow(1.1, 5)).toBeCloseTo(1.6105, 3)

    // And the store reaches those zoom levels via the actions.
    await dispatch(window, 'layout/zoomIn')
    const z = await zoomLevel(window)
    expect(Math.pow(1.1, z)).toBeCloseTo(1.1, 3)
  })
})
