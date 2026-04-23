// Traces: LYT-002 (canonical spec: specs/layout-view/spec.md)
import { test, expect, waitForAppReady } from '../../fixtures'

async function dispatchSetSplitRatio(
  window: import('@playwright/test').Page,
  ratio: number
): Promise<number> {
  return window.evaluate((r) => {
    const store = (window as any).__REDUX_STORE__
    store.dispatch({ type: 'layout/setSplitRatio', payload: r })
    return store.getState().layout.splitRatio as number
  }, ratio)
}

test.describe('LYT-002: Split Ratio Clamped to [0.2, 0.8]', () => {
  test.beforeEach(async ({ window }) => {
    await waitForAppReady(window)
  })

  test('ratio 0.5 is accepted as-is', async ({ window }) => {
    const ratio = await dispatchSetSplitRatio(window, 0.5)
    expect(ratio).toBeCloseTo(0.5, 5)
  })

  test('ratio below 0.2 is coerced up to 0.2', async ({ window }) => {
    const ratio = await dispatchSetSplitRatio(window, 0.05)
    expect(ratio).toBeCloseTo(0.2, 5)

    const ratioNeg = await dispatchSetSplitRatio(window, -1)
    expect(ratioNeg).toBeCloseTo(0.2, 5)
  })

  test('ratio above 0.8 is coerced down to 0.8', async ({ window }) => {
    const ratio = await dispatchSetSplitRatio(window, 0.95)
    expect(ratio).toBeCloseTo(0.8, 5)

    const ratioHuge = await dispatchSetSplitRatio(window, 5)
    expect(ratioHuge).toBeCloseTo(0.8, 5)
  })

  test('clamp applies through reducer — no caller bypass', async ({ window }) => {
    // Even if we try to set via dispatched action with extreme payload, state is clamped
    const final = await window.evaluate(() => {
      const store = (window as any).__REDUX_STORE__
      store.dispatch({ type: 'layout/setSplitRatio', payload: 100 })
      const high = store.getState().layout.splitRatio
      store.dispatch({ type: 'layout/setSplitRatio', payload: -100 })
      const low = store.getState().layout.splitRatio
      return { high, low }
    })
    expect(final.high).toBeCloseTo(0.8, 5)
    expect(final.low).toBeCloseTo(0.2, 5)
  })
})
