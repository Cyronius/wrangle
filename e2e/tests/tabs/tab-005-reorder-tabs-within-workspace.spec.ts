// Traces: TAB-005 (canonical spec: specs/tabs/spec.md)
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

test.describe('TAB-005: Reorder Tabs Within Workspace', () => {
  test.beforeEach(async ({ window }) => {
    await waitForAppReady(window)
    await resetTabs(window)
    await addWorkspace(window, { id: 'ws-tab005-a', name: 'A' })
    await addWorkspace(window, { id: 'ws-tab005-b', name: 'B' })
    await initWorkspace(window, 'ws-tab005-a')
    await initWorkspace(window, 'ws-tab005-b')
  })

  test('reorderTabs moves a tab using workspace-relative indices', async ({ window }) => {
    await addTab(window, { id: 'a1', workspaceId: 'ws-tab005-a', filename: 'a1.md' })
    await addTab(window, { id: 'a2', workspaceId: 'ws-tab005-a', filename: 'a2.md' })
    await addTab(window, { id: 'a3', workspaceId: 'ws-tab005-a', filename: 'a3.md' })

    // Move a1 (ws-relative 0) to ws-relative 2
    await dispatchAction(window, 'tabs/reorderTabs', {
      workspaceId: 'ws-tab005-a',
      oldIndex: 0,
      newIndex: 2
    })

    const dom = await getDomTabs(window, 'ws-tab005-a')
    expect(dom.map((t) => t.label)).toEqual(['a2.md', 'a3.md', 'a1.md'])
  })

  test('tabs in other workspaces are untouched and preserve their relative order', async ({
    window
  }) => {
    // Interleave across workspaces in global order: a1, b1, a2, b2, a3
    await addTab(window, { id: 'a1', workspaceId: 'ws-tab005-a', filename: 'a1.md' })
    await addTab(window, { id: 'b1', workspaceId: 'ws-tab005-b', filename: 'b1.md' })
    await addTab(window, { id: 'a2', workspaceId: 'ws-tab005-a', filename: 'a2.md' })
    await addTab(window, { id: 'b2', workspaceId: 'ws-tab005-b', filename: 'b2.md' })
    await addTab(window, { id: 'a3', workspaceId: 'ws-tab005-a', filename: 'a3.md' })

    await dispatchAction(window, 'tabs/reorderTabs', {
      workspaceId: 'ws-tab005-a',
      oldIndex: 0,
      newIndex: 2
    })

    const state = await getTabsState(window)
    const aIds = state.tabs.filter((t) => t.workspaceId === 'ws-tab005-a').map((t) => t.id)
    const bIds = state.tabs.filter((t) => t.workspaceId === 'ws-tab005-b').map((t) => t.id)
    expect(aIds).toEqual(['a2', 'a3', 'a1'])
    expect(bIds).toEqual(['b1', 'b2']) // relative order of B preserved
  })

  test('is a no-op when oldIndex === newIndex', async ({ window }) => {
    await addTab(window, { id: 'x1', workspaceId: 'ws-tab005-a', filename: 'x1.md' })
    await addTab(window, { id: 'x2', workspaceId: 'ws-tab005-a', filename: 'x2.md' })

    await dispatchAction(window, 'tabs/reorderTabs', {
      workspaceId: 'ws-tab005-a',
      oldIndex: 1,
      newIndex: 1
    })

    const dom = await getDomTabs(window, 'ws-tab005-a')
    expect(dom.map((t) => t.label)).toEqual(['x1.md', 'x2.md'])
  })

  test('is a no-op when an index is out of range', async ({ window }) => {
    await addTab(window, { id: 'r1', workspaceId: 'ws-tab005-a', filename: 'r1.md' })
    await addTab(window, { id: 'r2', workspaceId: 'ws-tab005-a', filename: 'r2.md' })

    await dispatchAction(window, 'tabs/reorderTabs', {
      workspaceId: 'ws-tab005-a',
      oldIndex: 0,
      newIndex: 99
    })

    const dom = await getDomTabs(window, 'ws-tab005-a')
    expect(dom.map((t) => t.label)).toEqual(['r1.md', 'r2.md'])
  })

  test('reordering does not change active-tab assignments', async ({ window }) => {
    await addTab(window, { id: 'p1', workspaceId: 'ws-tab005-a', filename: 'p1.md' })
    await addTab(window, { id: 'p2', workspaceId: 'ws-tab005-a', filename: 'p2.md' })
    await addTab(window, { id: 'p3', workspaceId: 'ws-tab005-a', filename: 'p3.md' })
    // p3 is active
    await dispatchAction(window, 'tabs/setActiveTab', 'p2')

    await dispatchAction(window, 'tabs/reorderTabs', {
      workspaceId: 'ws-tab005-a',
      oldIndex: 0,
      newIndex: 2
    })

    const state = await getTabsState(window)
    expect(state.activeTabIdByWorkspace['ws-tab005-a']).toBe('p2')
  })

  test.afterEach(async ({ window }) => {
    await resetTabs(window)
  })
})
