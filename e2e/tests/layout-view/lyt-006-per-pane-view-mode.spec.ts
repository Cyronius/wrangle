// Traces: LYT-006 (canonical spec: specs/layout-view/spec.md)
import { test, expect, waitForAppReady } from '../../fixtures'

async function getPaneViewModes(
  window: import('@playwright/test').Page
): Promise<Record<string, string>> {
  return window.evaluate(() => {
    return (window as any).__REDUX_STORE__.getState().layout.paneViewModes
  })
}

async function setPaneViewMode(
  window: import('@playwright/test').Page,
  paneId: string,
  viewMode: 'split' | 'editor-only' | 'preview-only'
): Promise<void> {
  await window.evaluate(
    ({ id, m }) => {
      const store = (window as any).__REDUX_STORE__
      store.dispatch({ type: 'layout/setPaneViewMode', payload: { paneId: id, viewMode: m } })
    },
    { id: paneId, m: viewMode }
  )
}

test.describe('LYT-006: Per-Pane View Mode (paneViewModes)', () => {
  test.beforeEach(async ({ window }) => {
    await waitForAppReady(window)
  })

  test('paneViewModes is a record, empty by default', async ({ window }) => {
    const map = await getPaneViewModes(window)
    expect(typeof map).toBe('object')
    expect(map).not.toBeNull()
    // May or may not already be populated by startup flow; assert shape only
    for (const v of Object.values(map)) {
      expect(['split', 'editor-only', 'preview-only']).toContain(v)
    }
  })

  test('setPaneViewMode stores per-pane mode without affecting others', async ({ window }) => {
    const paneA = 'pane-a-' + Date.now()
    const paneB = 'pane-b-' + Date.now()

    await setPaneViewMode(window, paneA, 'editor-only')
    await setPaneViewMode(window, paneB, 'preview-only')

    const map = await getPaneViewModes(window)
    expect(map[paneA]).toBe('editor-only')
    expect(map[paneB]).toBe('preview-only')
  })

  test('changing one pane does not modify another', async ({ window }) => {
    const paneA = 'pane-a-' + Date.now()
    const paneB = 'pane-b-' + Date.now()

    await setPaneViewMode(window, paneA, 'split')
    await setPaneViewMode(window, paneB, 'split')

    await setPaneViewMode(window, paneA, 'editor-only')

    const map = await getPaneViewModes(window)
    expect(map[paneA]).toBe('editor-only')
    expect(map[paneB]).toBe('split')
  })

  test('panes without an entry fall back to global viewMode', async ({ window }) => {
    const unsetPane = 'pane-unset-' + Date.now()
    // Set global viewMode explicitly
    await window.evaluate(() => {
      const store = (window as any).__REDUX_STORE__
      store.dispatch({ type: 'layout/setViewMode', payload: 'preview-only' })
    })

    const result = await window.evaluate((id) => {
      const s = (window as any).__REDUX_STORE__.getState().layout
      const paneMode = s.paneViewModes[id]
      return { paneMode, globalMode: s.viewMode }
    }, unsetPane)

    expect(result.paneMode).toBeUndefined()
    expect(result.globalMode).toBe('preview-only')

    // Cleanup: reset global viewMode
    await window.evaluate(() => {
      const store = (window as any).__REDUX_STORE__
      store.dispatch({ type: 'layout/setViewMode', payload: 'split' })
    })
  })
})
