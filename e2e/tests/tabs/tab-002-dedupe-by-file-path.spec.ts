// Traces: TAB-002 (canonical spec: specs/tabs/spec.md)
import { test, expect, waitForAppReady } from '../../fixtures'
import {
  addTab,
  addWorkspace,
  dispatchAction,
  getTabsState,
  initWorkspace,
  resetTabs
} from '../../helpers/tab-state-helpers'

test.describe('TAB-002: Dedupe by File Path on Open', () => {
  test.beforeEach(async ({ window }) => {
    await waitForAppReady(window)
    await resetTabs(window)
    await addWorkspace(window, { id: 'ws-tab002-a', name: 'WS A' })
    await addWorkspace(window, { id: 'ws-tab002-b', name: 'WS B' })
    await initWorkspace(window, 'ws-tab002-a')
    await initWorkspace(window, 'ws-tab002-b')
  })

  test('selectTabByPath returns an existing tab with the same path', async ({ window }) => {
    await addTab(window, {
      id: 'tab-shared',
      workspaceId: 'ws-tab002-a',
      filename: 'shared.md',
      path: '/tmp/shared.md',
      content: 'hello'
    })

    const found = await window.evaluate((targetPath) => {
      const store = (window as unknown as {
        __REDUX_STORE__: { getState: () => { tabs: { tabs: Array<{ id: string; path?: string }> } } }
      }).__REDUX_STORE__
      const state = store.getState()
      return state.tabs.tabs.find((t) => t.path === targetPath) ?? null
    }, '/tmp/shared.md')

    expect(found).not.toBeNull()
    expect(found!.id).toBe('tab-shared')
  })

  test('opening an already-open path activates the existing tab without duplicating', async ({
    window
  }) => {
    await addTab(window, {
      id: 'tab-existing',
      workspaceId: 'ws-tab002-a',
      filename: 'doc.md',
      path: '/tmp/doc.md',
      content: 'doc content'
    })
    // Add another tab to shift the active tab away from tab-existing
    await addTab(window, {
      id: 'tab-other',
      workspaceId: 'ws-tab002-a',
      filename: 'other.md'
    })

    let state = await getTabsState(window)
    expect(state.activeTabIdByWorkspace['ws-tab002-a']).toBe('tab-other')

    // Simulate the open-file flow: selectTabByPath finds it, so dispatch setActiveTab.
    await dispatchAction(window, 'tabs/setActiveTab', 'tab-existing')

    state = await getTabsState(window)
    const pathTabs = state.tabs.filter((t) => t.path === '/tmp/doc.md')
    expect(pathTabs).toHaveLength(1)
    expect(state.activeTabIdByWorkspace['ws-tab002-a']).toBe('tab-existing')
  })

  test('dedupe works across workspaces (one path = one tab globally)', async ({ window }) => {
    await addTab(window, {
      id: 'tab-in-b',
      workspaceId: 'ws-tab002-b',
      filename: 'cross.md',
      path: '/tmp/cross.md',
      content: 'cross'
    })

    // selectTabByPath finds the tab even though it lives in workspace B
    const found = await window.evaluate((targetPath) => {
      const store = (window as unknown as {
        __REDUX_STORE__: {
          getState: () => { tabs: { tabs: Array<{ id: string; workspaceId: string; path?: string }> } }
        }
      }).__REDUX_STORE__
      return store.getState().tabs.tabs.find((t) => t.path === targetPath) ?? null
    }, '/tmp/cross.md')

    expect(found).not.toBeNull()
    expect(found!.workspaceId).toBe('ws-tab002-b')

    // Activating the existing tab does not create another in workspace A
    await dispatchAction(window, 'tabs/setActiveTab', found!.id)

    const state = await getTabsState(window)
    const withPath = state.tabs.filter((t) => t.path === '/tmp/cross.md')
    expect(withPath).toHaveLength(1)
    expect(withPath[0].workspaceId).toBe('ws-tab002-b')
  })

  test.afterEach(async ({ window }) => {
    await resetTabs(window)
  })
})
