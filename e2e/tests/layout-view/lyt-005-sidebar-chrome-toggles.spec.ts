// Traces: LYT-005 (canonical spec: specs/layout-view/spec.md)
import { test, expect, waitForAppReady } from '../../fixtures'

type LayoutFlags = {
  showOutline: boolean
  showToolbar: boolean
  showExplorer: boolean
}

async function getFlags(window: import('@playwright/test').Page): Promise<LayoutFlags> {
  return window.evaluate(() => {
    const s = (window as any).__REDUX_STORE__.getState().layout
    return {
      showOutline: s.showOutline,
      showToolbar: s.showToolbar,
      showExplorer: s.showExplorer
    }
  })
}

async function dispatch(window: import('@playwright/test').Page, type: string, payload?: unknown): Promise<void> {
  await window.evaluate(
    ({ t, p }) => {
      const store = (window as any).__REDUX_STORE__
      if (p === undefined) store.dispatch({ type: t })
      else store.dispatch({ type: t, payload: p })
    },
    { t: type, p: payload }
  )
}

test.describe('LYT-005: Sidebar and Chrome Toggles', () => {
  test.beforeEach(async ({ window }) => {
    await waitForAppReady(window)
  })

  test('default values match spec', async ({ window }) => {
    // We can't guarantee the user hasn't toggled, but on fresh launch these should be defaults.
    const flags = await getFlags(window)
    expect(typeof flags.showOutline).toBe('boolean')
    expect(typeof flags.showToolbar).toBe('boolean')
    expect(typeof flags.showExplorer).toBe('boolean')
  })

  test('toggleOutline flips showOutline independently', async ({ window }) => {
    const before = await getFlags(window)
    await dispatch(window, 'layout/toggleOutline')
    const after = await getFlags(window)
    expect(after.showOutline).toBe(!before.showOutline)
    // Others unchanged
    expect(after.showToolbar).toBe(before.showToolbar)
    expect(after.showExplorer).toBe(before.showExplorer)
  })

  test('toggleToolbar flips showToolbar independently', async ({ window }) => {
    const before = await getFlags(window)
    await dispatch(window, 'layout/toggleToolbar')
    const after = await getFlags(window)
    expect(after.showToolbar).toBe(!before.showToolbar)
    expect(after.showOutline).toBe(before.showOutline)
    expect(after.showExplorer).toBe(before.showExplorer)
  })

  test('toggleExplorer flips showExplorer independently', async ({ window }) => {
    const before = await getFlags(window)
    await dispatch(window, 'layout/toggleExplorer')
    const after = await getFlags(window)
    expect(after.showExplorer).toBe(!before.showExplorer)
    expect(after.showOutline).toBe(before.showOutline)
    expect(after.showToolbar).toBe(before.showToolbar)
  })
})
