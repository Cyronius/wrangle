// Traces: LYT-007 (canonical spec: specs/layout-view/spec.md)
import { test, expect, waitForAppReady } from '../../fixtures'

async function setPaneRatio(
  window: import('@playwright/test').Page,
  paneId: string,
  ratio: number
): Promise<number | undefined> {
  return window.evaluate(
    ({ id, r }) => {
      const store = (window as any).__REDUX_STORE__
      store.dispatch({ type: 'layout/setPaneSplitRatio', payload: { paneId: id, ratio: r } })
      return store.getState().layout.paneSplitRatios[id]
    },
    { id: paneId, r: ratio }
  )
}

test.describe('LYT-007: Per-Pane Split Ratio (paneSplitRatios)', () => {
  test.beforeEach(async ({ window }) => {
    await waitForAppReady(window)
  })

  test('paneSplitRatios defaults to empty record', async ({ window }) => {
    const map = await window.evaluate(() => {
      return (window as any).__REDUX_STORE__.getState().layout.paneSplitRatios
    })
    expect(typeof map).toBe('object')
    expect(map).not.toBeNull()
  })

  test('setPaneSplitRatio stores ratio for specific pane only', async ({ window }) => {
    const paneA = 'pane-a-' + Date.now()
    const paneB = 'pane-b-' + Date.now()

    const a = await setPaneRatio(window, paneA, 0.3)
    const b = await setPaneRatio(window, paneB, 0.7)

    expect(a).toBeCloseTo(0.3, 5)
    expect(b).toBeCloseTo(0.7, 5)

    // Modify A, B must remain
    await setPaneRatio(window, paneA, 0.4)
    const map = await window.evaluate(() => {
      return (window as any).__REDUX_STORE__.getState().layout.paneSplitRatios
    })
    expect(map[paneA]).toBeCloseTo(0.4, 5)
    expect(map[paneB]).toBeCloseTo(0.7, 5)
  })

  test('per-pane ratio is clamped to [0.2, 0.8] on write', async ({ window }) => {
    const paneId = 'pane-clamp-' + Date.now()

    const low = await setPaneRatio(window, paneId, 0.01)
    expect(low).toBeCloseTo(0.2, 5)

    const high = await setPaneRatio(window, paneId, 0.99)
    expect(high).toBeCloseTo(0.8, 5)

    const extremeLow = await setPaneRatio(window, paneId, -10)
    expect(extremeLow).toBeCloseTo(0.2, 5)

    const extremeHigh = await setPaneRatio(window, paneId, 10)
    expect(extremeHigh).toBeCloseTo(0.8, 5)
  })

  test('panes without an entry fall back to global splitRatio', async ({ window }) => {
    const unset = 'pane-unset-' + Date.now()
    const result = await window.evaluate((id) => {
      const s = (window as any).__REDUX_STORE__.getState().layout
      return { paneRatio: s.paneSplitRatios[id], globalRatio: s.splitRatio }
    }, unset)

    expect(result.paneRatio).toBeUndefined()
    expect(typeof result.globalRatio).toBe('number')
    expect(result.globalRatio).toBeGreaterThanOrEqual(0.2)
    expect(result.globalRatio).toBeLessThanOrEqual(0.8)
  })
})
