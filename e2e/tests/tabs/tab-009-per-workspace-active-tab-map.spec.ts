// Traces: TAB-009 (canonical spec: specs/tabs/spec.md)
import { test, expect, waitForAppReady } from '../../fixtures'
import {
  addTab,
  addWorkspace,
  dispatchAction,
  getTabsState,
  initWorkspace,
  resetTabs
} from '../../helpers/tab-state-helpers'

test.describe('TAB-009: Per-Workspace Active Tab Map', () => {
  test.beforeEach(async ({ window }) => {
    await waitForAppReady(window)
    await resetTabs(window)
    await addWorkspace(window, { id: 'ws-tab009-a', name: 'A' })
    await addWorkspace(window, { id: 'ws-tab009-b', name: 'B' })
    await initWorkspace(window, 'ws-tab009-a')
    await initWorkspace(window, 'ws-tab009-b')
  })

  test('state.activeTabIdByWorkspace is a record keyed by workspace id', async ({ window }) => {
    const state = await getTabsState(window)
    expect(state.activeTabIdByWorkspace).toHaveProperty('ws-tab009-a')
    expect(state.activeTabIdByWorkspace).toHaveProperty('ws-tab009-b')
    expect(state.activeTabIdByWorkspace['ws-tab009-a']).toBeNull()
    expect(state.activeTabIdByWorkspace['ws-tab009-b']).toBeNull()
  })

  test('setActiveTab only updates the entry for the target tab\'s workspace', async ({
    window
  }) => {
    await addTab(window, { id: 'a1', workspaceId: 'ws-tab009-a', filename: 'a1.md' })
    await addTab(window, { id: 'a2', workspaceId: 'ws-tab009-a', filename: 'a2.md' })
    await addTab(window, { id: 'b1', workspaceId: 'ws-tab009-b', filename: 'b1.md' })

    // Active: a=a2, b=b1. setActiveTab(a1) should only change A.
    await dispatchAction(window, 'tabs/setActiveTab', 'a1')
    const state = await getTabsState(window)
    expect(state.activeTabIdByWorkspace['ws-tab009-a']).toBe('a1')
    expect(state.activeTabIdByWorkspace['ws-tab009-b']).toBe('b1')
  })

  test('initWorkspaceActiveTab creates an entry initialized to null', async ({ window }) => {
    await dispatchAction(window, 'tabs/initWorkspaceActiveTab', 'ws-tab009-new')
    const state = await getTabsState(window)
    expect(state.activeTabIdByWorkspace).toHaveProperty('ws-tab009-new')
    expect(state.activeTabIdByWorkspace['ws-tab009-new']).toBeNull()
  })

  test('initWorkspaceActiveTab does not clobber an existing entry', async ({ window }) => {
    await addTab(window, { id: 'x', workspaceId: 'ws-tab009-a', filename: 'x.md' })
    // Active is now x
    await dispatchAction(window, 'tabs/initWorkspaceActiveTab', 'ws-tab009-a')
    const state = await getTabsState(window)
    expect(state.activeTabIdByWorkspace['ws-tab009-a']).toBe('x')
  })

  test('cleanupWorkspaceActiveTab removes the entry for a destroyed workspace', async ({
    window
  }) => {
    await dispatchAction(window, 'tabs/initWorkspaceActiveTab', 'ws-tab009-disposable')
    let state = await getTabsState(window)
    expect(state.activeTabIdByWorkspace).toHaveProperty('ws-tab009-disposable')

    await dispatchAction(window, 'tabs/cleanupWorkspaceActiveTab', 'ws-tab009-disposable')
    state = await getTabsState(window)
    expect(state.activeTabIdByWorkspace).not.toHaveProperty('ws-tab009-disposable')
  })

  test.afterEach(async ({ window }) => {
    await resetTabs(window)
  })
})
