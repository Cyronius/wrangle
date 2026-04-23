// Traces: TAB-012 (canonical spec: specs/tabs/spec.md)
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

test.describe('TAB-012: Close All Tabs in a Workspace', () => {
  test.beforeEach(async ({ window }) => {
    await waitForAppReady(window)
    await resetTabs(window)
    await addWorkspace(window, { id: 'ws-tab012-target', name: 'TARGET' })
    await addWorkspace(window, { id: 'ws-tab012-spared', name: 'SPARED' })
    await initWorkspace(window, 'ws-tab012-target')
    await initWorkspace(window, 'ws-tab012-spared')
  })

  test('closeTabsByWorkspace removes every tab in the target workspace', async ({ window }) => {
    await addTab(window, { id: 't1', workspaceId: 'ws-tab012-target', filename: 't1.md' })
    await addTab(window, { id: 't2', workspaceId: 'ws-tab012-target', filename: 't2.md' })
    await addTab(window, { id: 't3', workspaceId: 'ws-tab012-target', filename: 't3.md' })

    await dispatchAction(window, 'tabs/closeTabsByWorkspace', 'ws-tab012-target')

    const state = await getTabsState(window)
    const remaining = state.tabs.filter((t) => t.workspaceId === 'ws-tab012-target')
    expect(remaining).toHaveLength(0)
  })

  test('closeTabsByWorkspace sets activeTabIdByWorkspace[workspaceId] to null', async ({
    window
  }) => {
    await addTab(window, { id: 'ta', workspaceId: 'ws-tab012-target', filename: 'ta.md' })
    await addTab(window, { id: 'tb', workspaceId: 'ws-tab012-target', filename: 'tb.md' })

    await dispatchAction(window, 'tabs/closeTabsByWorkspace', 'ws-tab012-target')

    const state = await getTabsState(window)
    expect(state.activeTabIdByWorkspace['ws-tab012-target']).toBeNull()
  })

  test('tabs in other workspaces are not affected', async ({ window }) => {
    await addTab(window, { id: 'target1', workspaceId: 'ws-tab012-target', filename: 'tg1.md' })
    await addTab(window, { id: 'target2', workspaceId: 'ws-tab012-target', filename: 'tg2.md' })
    await addTab(window, { id: 'spared1', workspaceId: 'ws-tab012-spared', filename: 'sp1.md' })
    await addTab(window, { id: 'spared2', workspaceId: 'ws-tab012-spared', filename: 'sp2.md' })

    await dispatchAction(window, 'tabs/closeTabsByWorkspace', 'ws-tab012-target')

    const state = await getTabsState(window)
    const sparedIds = state.tabs
      .filter((t) => t.workspaceId === 'ws-tab012-spared')
      .map((t) => t.id)
    expect(sparedIds).toEqual(['spared1', 'spared2'])
    // Active tab of spared workspace is whatever we last set (spared2)
    expect(state.activeTabIdByWorkspace['ws-tab012-spared']).toBe('spared2')

    const sparedDom = await getDomTabs(window, 'ws-tab012-spared')
    expect(sparedDom.map((t) => t.label)).toEqual(['sp1.md', 'sp2.md'])
  })

  test('closes tabs unconditionally regardless of dirty state (reducer-level)', async ({
    window
  }) => {
    await addTab(window, {
      id: 'dirty',
      workspaceId: 'ws-tab012-target',
      filename: 'dirty.md',
      isDirty: true
    })
    await addTab(window, {
      id: 'clean',
      workspaceId: 'ws-tab012-target',
      filename: 'clean.md',
      isDirty: false
    })

    await dispatchAction(window, 'tabs/closeTabsByWorkspace', 'ws-tab012-target')

    const state = await getTabsState(window)
    const remaining = state.tabs.filter((t) => t.workspaceId === 'ws-tab012-target')
    expect(remaining).toHaveLength(0)
    expect(state.activeTabIdByWorkspace['ws-tab012-target']).toBeNull()
  })

  test.afterEach(async ({ window }) => {
    await resetTabs(window)
  })
})
