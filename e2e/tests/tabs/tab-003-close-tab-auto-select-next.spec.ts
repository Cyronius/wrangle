// Traces: TAB-003 (canonical spec: specs/tabs/spec.md)
import { test, expect, waitForAppReady } from '../../fixtures'
import {
  addTab,
  addWorkspace,
  dispatchAction,
  getDomTabs,
  getTabsState,
  initWorkspace,
  resetTabs
} from '../../helpers/tab-state-helpers'

test.describe('TAB-003: Close Tab and Auto-Select Next', () => {
  test.beforeEach(async ({ window }) => {
    await waitForAppReady(window)
    await resetTabs(window)
    await addWorkspace(window, { id: 'ws-tab003-a', name: 'A' })
    await addWorkspace(window, { id: 'ws-tab003-b', name: 'B' })
    await initWorkspace(window, 'ws-tab003-a')
    await initWorkspace(window, 'ws-tab003-b')
  })

  test('closeTab removes the tab from state.tabs', async ({ window }) => {
    await addTab(window, { id: 't1', workspaceId: 'ws-tab003-a', filename: 'one.md' })
    await addTab(window, { id: 't2', workspaceId: 'ws-tab003-a', filename: 'two.md' })

    await dispatchAction(window, 'tabs/closeTab', 't1')

    const state = await getTabsState(window)
    const ids = state.tabs.filter((t) => t.workspaceId === 'ws-tab003-a').map((t) => t.id)
    expect(ids).toEqual(['t2'])

    const dom = await getDomTabs(window, 'ws-tab003-a')
    expect(dom.map((t) => t.label)).toEqual(['two.md'])
  })

  test('closing the active tab auto-selects the first remaining tab in the same workspace', async ({
    window
  }) => {
    await addTab(window, { id: 't1', workspaceId: 'ws-tab003-a', filename: 'one.md' })
    await addTab(window, { id: 't2', workspaceId: 'ws-tab003-a', filename: 'two.md' })
    await addTab(window, { id: 't3', workspaceId: 'ws-tab003-a', filename: 'three.md' })
    // t3 is now active. Close it.
    await dispatchAction(window, 'tabs/closeTab', 't3')

    const state = await getTabsState(window)
    expect(state.activeTabIdByWorkspace['ws-tab003-a']).toBe('t1')

    const dom = await getDomTabs(window, 'ws-tab003-a')
    const active = dom.filter((t) => t.isActive)
    expect(active.map((t) => t.label)).toEqual(['one.md'])
  })

  test('closing the last tab in a workspace sets its active tab to null', async ({ window }) => {
    await addTab(window, { id: 'solo', workspaceId: 'ws-tab003-a', filename: 'solo.md' })
    await dispatchAction(window, 'tabs/closeTab', 'solo')

    const state = await getTabsState(window)
    expect(state.activeTabIdByWorkspace['ws-tab003-a']).toBeNull()
  })

  test('closing a tab does not affect active tabs in other workspaces', async ({ window }) => {
    await addTab(window, { id: 'a1', workspaceId: 'ws-tab003-a', filename: 'a1.md' })
    await addTab(window, { id: 'b1', workspaceId: 'ws-tab003-b', filename: 'b1.md' })
    await addTab(window, { id: 'b2', workspaceId: 'ws-tab003-b', filename: 'b2.md' })

    // Active tabs: ws-a -> a1, ws-b -> b2
    await dispatchAction(window, 'tabs/closeTab', 'a1')

    const state = await getTabsState(window)
    expect(state.activeTabIdByWorkspace['ws-tab003-a']).toBeNull()
    expect(state.activeTabIdByWorkspace['ws-tab003-b']).toBe('b2')
  })

  test.afterEach(async ({ window }) => {
    await resetTabs(window)
  })
})
