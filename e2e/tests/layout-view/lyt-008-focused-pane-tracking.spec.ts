// Traces: LYT-008 (canonical spec: specs/layout-view/spec.md)
import { test, expect, waitForAppReady } from '../../fixtures'

async function getFocusedPaneId(
  window: import('@playwright/test').Page
): Promise<string | null> {
  return window.evaluate(() => {
    return (window as any).__REDUX_STORE__.getState().layout.focusedPaneId
  })
}

async function setFocusedPane(
  window: import('@playwright/test').Page,
  id: string
): Promise<void> {
  await window.evaluate((paneId) => {
    const store = (window as any).__REDUX_STORE__
    store.dispatch({ type: 'layout/setFocusedPane', payload: paneId })
  }, id)
}

test.describe('LYT-008: Focused-Pane Tracking (focusedPaneId)', () => {
  test.beforeEach(async ({ window }) => {
    await waitForAppReady(window)
  })

  test('focusedPaneId is either null or a string', async ({ window }) => {
    const id = await getFocusedPaneId(window)
    expect(id === null || typeof id === 'string').toBe(true)
  })

  test('setFocusedPane updates focusedPaneId to given id', async ({ window }) => {
    const paneId = 'pane-focus-' + Date.now()
    await setFocusedPane(window, paneId)
    expect(await getFocusedPaneId(window)).toBe(paneId)
  })

  test('setFocusedPane can be called repeatedly to change focus', async ({ window }) => {
    const a = 'pane-a-' + Date.now()
    const b = 'pane-b-' + Date.now()

    await setFocusedPane(window, a)
    expect(await getFocusedPaneId(window)).toBe(a)

    await setFocusedPane(window, b)
    expect(await getFocusedPaneId(window)).toBe(b)

    await setFocusedPane(window, a)
    expect(await getFocusedPaneId(window)).toBe(a)
  })
})
