// Traces: TAB-001 (canonical spec: specs/tabs/spec.md)
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

test.describe('TAB-001: Add Tab and Auto-Activate', () => {
  test.beforeEach(async ({ window }) => {
    await waitForAppReady(window)
    await resetTabs(window)
    await addWorkspace(window, { id: 'ws-tab001', name: 'TAB001 WS' })
    await initWorkspace(window, 'ws-tab001')
  })

  test('appends the new tab to state.tabs', async ({ window }) => {
    await addTab(window, {
      id: 'tab-a',
      workspaceId: 'ws-tab001',
      filename: 'a.md',
      content: '# A'
    })
    await addTab(window, {
      id: 'tab-b',
      workspaceId: 'ws-tab001',
      filename: 'b.md',
      content: '# B'
    })

    const state = await getTabsState(window)
    const ids = state.tabs
      .filter((t) => t.workspaceId === 'ws-tab001')
      .map((t) => t.id)
    expect(ids).toEqual(['tab-a', 'tab-b'])

    const domTabs = await getDomTabs(window, 'ws-tab001')
    expect(domTabs.map((t) => t.label)).toEqual(['a.md', 'b.md'])
  })

  test('makes the new tab the active tab for its workspace', async ({ window }) => {
    await addTab(window, {
      id: 'tab-first',
      workspaceId: 'ws-tab001',
      filename: 'first.md'
    })
    await addTab(window, {
      id: 'tab-second',
      workspaceId: 'ws-tab001',
      filename: 'second.md'
    })

    const state = await getTabsState(window)
    expect(state.activeTabIdByWorkspace['ws-tab001']).toBe('tab-second')

    const domTabs = await getDomTabs(window, 'ws-tab001')
    const active = domTabs.filter((t) => t.isActive)
    expect(active).toHaveLength(1)
    expect(active[0].label).toBe('second.md')
  })

  test('is idempotent when a tab with the same id already exists', async ({ window }) => {
    await addTab(window, {
      id: 'dup-tab',
      workspaceId: 'ws-tab001',
      filename: 'orig.md',
      content: '# orig'
    })
    await addTab(window, {
      id: 'other-tab',
      workspaceId: 'ws-tab001',
      filename: 'other.md'
    })
    // other-tab is active; now re-add dup-tab (should be a no-op)
    await addTab(window, {
      id: 'dup-tab',
      workspaceId: 'ws-tab001',
      filename: 'DIFFERENT.md',
      content: '# changed'
    })

    const state = await getTabsState(window)
    const wsTabs = state.tabs.filter((t) => t.workspaceId === 'ws-tab001')
    // No duplicate inserted
    const dupCount = wsTabs.filter((t) => t.id === 'dup-tab').length
    expect(dupCount).toBe(1)
    expect(wsTabs).toHaveLength(2)
    // Original content preserved (no-op)
    const dup = wsTabs.find((t) => t.id === 'dup-tab')!
    expect(dup.filename).toBe('orig.md')
    expect(dup.content).toBe('# orig')
    // Active tab unchanged
    expect(state.activeTabIdByWorkspace['ws-tab001']).toBe('other-tab')
  })

  test.afterEach(async ({ window }) => {
    await resetTabs(window)
    await dispatchAction(window, 'workspaces/removeWorkspace', 'ws-tab001').catch(() => {})
  })
})
