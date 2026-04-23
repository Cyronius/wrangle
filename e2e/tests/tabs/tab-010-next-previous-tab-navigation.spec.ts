// Traces: TAB-010 (canonical spec: specs/tabs/spec.md)
import { test, expect, waitForAppReady } from '../../fixtures'
import {
  addTab,
  addWorkspace,
  dispatchAction,
  getTabsState,
  initWorkspace,
  resetTabs
} from '../../helpers/tab-state-helpers'

test.describe('TAB-010: Next/Previous Tab Navigation', () => {
  test.beforeEach(async ({ window }) => {
    await waitForAppReady(window)
    await resetTabs(window)
    await addWorkspace(window, { id: 'ws-tab010-a', name: 'NAV' })
    await addWorkspace(window, { id: 'ws-tab010-b', name: 'OTHER' })
    await initWorkspace(window, 'ws-tab010-a')
    await initWorkspace(window, 'ws-tab010-b')
  })

  test('nextTab activates the tab immediately after the current active tab', async ({
    window
  }) => {
    await addTab(window, { id: 'n1', workspaceId: 'ws-tab010-a', filename: 'n1.md' })
    await addTab(window, { id: 'n2', workspaceId: 'ws-tab010-a', filename: 'n2.md' })
    await addTab(window, { id: 'n3', workspaceId: 'ws-tab010-a', filename: 'n3.md' })
    await dispatchAction(window, 'tabs/setActiveTab', 'n1')

    await dispatchAction(window, 'tabs/nextTab', 'ws-tab010-a')
    let state = await getTabsState(window)
    expect(state.activeTabIdByWorkspace['ws-tab010-a']).toBe('n2')

    await dispatchAction(window, 'tabs/nextTab', 'ws-tab010-a')
    state = await getTabsState(window)
    expect(state.activeTabIdByWorkspace['ws-tab010-a']).toBe('n3')
  })

  test('nextTab wraps from the last tab to the first', async ({ window }) => {
    await addTab(window, { id: 'w1', workspaceId: 'ws-tab010-a', filename: 'w1.md' })
    await addTab(window, { id: 'w2', workspaceId: 'ws-tab010-a', filename: 'w2.md' })
    // w2 is active
    await dispatchAction(window, 'tabs/nextTab', 'ws-tab010-a')
    const state = await getTabsState(window)
    expect(state.activeTabIdByWorkspace['ws-tab010-a']).toBe('w1')
  })

  test('previousTab activates the tab immediately before the active tab', async ({ window }) => {
    await addTab(window, { id: 'p1', workspaceId: 'ws-tab010-a', filename: 'p1.md' })
    await addTab(window, { id: 'p2', workspaceId: 'ws-tab010-a', filename: 'p2.md' })
    await addTab(window, { id: 'p3', workspaceId: 'ws-tab010-a', filename: 'p3.md' })
    // p3 active
    await dispatchAction(window, 'tabs/previousTab', 'ws-tab010-a')
    const state = await getTabsState(window)
    expect(state.activeTabIdByWorkspace['ws-tab010-a']).toBe('p2')
  })

  test('previousTab wraps from the first tab to the last', async ({ window }) => {
    await addTab(window, { id: 'pw1', workspaceId: 'ws-tab010-a', filename: 'pw1.md' })
    await addTab(window, { id: 'pw2', workspaceId: 'ws-tab010-a', filename: 'pw2.md' })
    await addTab(window, { id: 'pw3', workspaceId: 'ws-tab010-a', filename: 'pw3.md' })
    await dispatchAction(window, 'tabs/setActiveTab', 'pw1')

    await dispatchAction(window, 'tabs/previousTab', 'ws-tab010-a')
    const state = await getTabsState(window)
    expect(state.activeTabIdByWorkspace['ws-tab010-a']).toBe('pw3')
  })

  test('is a no-op with zero or one tab in the workspace', async ({ window }) => {
    // Zero tabs
    let before = await getTabsState(window)
    const beforeVal = before.activeTabIdByWorkspace['ws-tab010-a']
    await dispatchAction(window, 'tabs/nextTab', 'ws-tab010-a')
    await dispatchAction(window, 'tabs/previousTab', 'ws-tab010-a')
    let after = await getTabsState(window)
    expect(after.activeTabIdByWorkspace['ws-tab010-a']).toBe(beforeVal)

    // One tab
    await addTab(window, { id: 'only', workspaceId: 'ws-tab010-a', filename: 'only.md' })
    before = await getTabsState(window)
    await dispatchAction(window, 'tabs/nextTab', 'ws-tab010-a')
    await dispatchAction(window, 'tabs/previousTab', 'ws-tab010-a')
    after = await getTabsState(window)
    expect(after.activeTabIdByWorkspace['ws-tab010-a']).toBe(
      before.activeTabIdByWorkspace['ws-tab010-a']
    )
    expect(after.activeTabIdByWorkspace['ws-tab010-a']).toBe('only')
  })

  test('navigation is scoped to the passed workspace and does not touch others', async ({
    window
  }) => {
    await addTab(window, { id: 'a1', workspaceId: 'ws-tab010-a', filename: 'a1.md' })
    await addTab(window, { id: 'a2', workspaceId: 'ws-tab010-a', filename: 'a2.md' })
    await addTab(window, { id: 'b1', workspaceId: 'ws-tab010-b', filename: 'b1.md' })
    await addTab(window, { id: 'b2', workspaceId: 'ws-tab010-b', filename: 'b2.md' })

    // Active: a=a2, b=b2
    await dispatchAction(window, 'tabs/nextTab', 'ws-tab010-a')
    const state = await getTabsState(window)
    expect(state.activeTabIdByWorkspace['ws-tab010-a']).toBe('a1') // wrapped
    expect(state.activeTabIdByWorkspace['ws-tab010-b']).toBe('b2') // untouched
  })

  test.afterEach(async ({ window }) => {
    await resetTabs(window)
  })
})
