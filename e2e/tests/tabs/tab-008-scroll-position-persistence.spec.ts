// Traces: TAB-008 (canonical spec: specs/tabs/spec.md)
import { test, expect, waitForAppReady } from '../../fixtures'
import {
  addTab,
  addWorkspace,
  dispatchAction,
  getTabsState,
  initWorkspace,
  resetTabs
} from '../../helpers/tab-state-helpers'

test.describe('TAB-008: Scroll Position Persistence Per Tab', () => {
  test.beforeEach(async ({ window }) => {
    await waitForAppReady(window)
    await resetTabs(window)
    await addWorkspace(window, { id: 'ws-tab008', name: 'SCROLL' })
    await initWorkspace(window, 'ws-tab008')
  })

  test('updateTabScroll stores scrollTop on the tab', async ({ window }) => {
    await addTab(window, {
      id: 's1',
      workspaceId: 'ws-tab008',
      filename: 'long.md',
      content: 'line\n'.repeat(100)
    })

    await dispatchAction(window, 'tabs/updateTabScroll', { id: 's1', scrollTop: 420 })

    const state = await getTabsState(window)
    expect(state.tabs.find((t) => t.id === 's1')!.scrollTop).toBe(420)
  })

  test('scrollTop is undefined on a fresh tab', async ({ window }) => {
    await addTab(window, {
      id: 'empty',
      workspaceId: 'ws-tab008',
      filename: 'empty.md',
      content: ''
    })
    const state = await getTabsState(window)
    expect(state.tabs.find((t) => t.id === 'empty')!.scrollTop).toBeUndefined()
  })

  test('scroll positions are independent per tab and survive activation changes', async ({
    window
  }) => {
    await addTab(window, {
      id: 'sa',
      workspaceId: 'ws-tab008',
      filename: 'a.md',
      content: 'x'.repeat(500)
    })
    await addTab(window, {
      id: 'sb',
      workspaceId: 'ws-tab008',
      filename: 'b.md',
      content: 'y'.repeat(500)
    })

    await dispatchAction(window, 'tabs/updateTabScroll', { id: 'sa', scrollTop: 100 })
    await dispatchAction(window, 'tabs/updateTabScroll', { id: 'sb', scrollTop: 700 })

    await dispatchAction(window, 'tabs/setActiveTab', 'sa')
    await dispatchAction(window, 'tabs/setActiveTab', 'sb')
    await dispatchAction(window, 'tabs/setActiveTab', 'sa')

    const state = await getTabsState(window)
    expect(state.tabs.find((t) => t.id === 'sa')!.scrollTop).toBe(100)
    expect(state.tabs.find((t) => t.id === 'sb')!.scrollTop).toBe(700)
  })

  test.afterEach(async ({ window }) => {
    await resetTabs(window)
  })
})
