// Traces: TAB-011 (canonical spec: specs/tabs/spec.md)
import { test, expect, waitForAppReady } from '../../fixtures'
import {
  addTab,
  addWorkspace,
  dispatchAction,
  getTabsState,
  initWorkspace,
  resetTabs
} from '../../helpers/tab-state-helpers'

test.describe('TAB-011: Move Tab to Another Workspace', () => {
  test.beforeEach(async ({ window }) => {
    await waitForAppReady(window)
    await resetTabs(window)
    await addWorkspace(window, { id: 'ws-tab011-src', name: 'SRC' })
    await addWorkspace(window, { id: 'ws-tab011-dst', name: 'DST' })
    await initWorkspace(window, 'ws-tab011-src')
    await initWorkspace(window, 'ws-tab011-dst')
  })

  test('moveTabToWorkspace updates the tab\'s workspaceId', async ({ window }) => {
    await addTab(window, {
      id: 'm1',
      workspaceId: 'ws-tab011-src',
      filename: 'm1.md',
      content: 'hello'
    })

    await dispatchAction(window, 'tabs/moveTabToWorkspace', {
      tabId: 'm1',
      newWorkspaceId: 'ws-tab011-dst'
    })

    const state = await getTabsState(window)
    const tab = state.tabs.find((t) => t.id === 'm1')!
    expect(tab.workspaceId).toBe('ws-tab011-dst')
  })

  test('previous workspace auto-selects next remaining tab when moved tab was active', async ({
    window
  }) => {
    await addTab(window, { id: 's1', workspaceId: 'ws-tab011-src', filename: 's1.md' })
    await addTab(window, { id: 's2', workspaceId: 'ws-tab011-src', filename: 's2.md' })
    // s2 is active. Move s2 to dst.
    await dispatchAction(window, 'tabs/moveTabToWorkspace', {
      tabId: 's2',
      newWorkspaceId: 'ws-tab011-dst'
    })

    const state = await getTabsState(window)
    expect(state.activeTabIdByWorkspace['ws-tab011-src']).toBe('s1')
  })

  test('previous workspace becomes null when moved tab was the last/active tab', async ({
    window
  }) => {
    await addTab(window, { id: 'solo', workspaceId: 'ws-tab011-src', filename: 'solo.md' })
    await dispatchAction(window, 'tabs/moveTabToWorkspace', {
      tabId: 'solo',
      newWorkspaceId: 'ws-tab011-dst'
    })

    const state = await getTabsState(window)
    expect(state.activeTabIdByWorkspace['ws-tab011-src']).toBeNull()
  })

  test('moved tab becomes the active tab in its new workspace', async ({ window }) => {
    await addTab(window, { id: 'd1', workspaceId: 'ws-tab011-dst', filename: 'd1.md' })
    await addTab(window, { id: 'moved', workspaceId: 'ws-tab011-src', filename: 'moved.md' })

    await dispatchAction(window, 'tabs/moveTabToWorkspace', {
      tabId: 'moved',
      newWorkspaceId: 'ws-tab011-dst'
    })

    const state = await getTabsState(window)
    expect(state.activeTabIdByWorkspace['ws-tab011-dst']).toBe('moved')
  })

  test('move preserves content, dirty state, cursor position, and scroll position', async ({
    window
  }) => {
    await addTab(window, {
      id: 'preserved',
      workspaceId: 'ws-tab011-src',
      filename: 'p.md',
      content: 'payload',
      isDirty: true
    })
    await dispatchAction(window, 'tabs/updateTabPosition', {
      id: 'preserved',
      cursorPosition: { lineNumber: 7, column: 3 }
    })
    await dispatchAction(window, 'tabs/updateTabScroll', { id: 'preserved', scrollTop: 250 })

    await dispatchAction(window, 'tabs/moveTabToWorkspace', {
      tabId: 'preserved',
      newWorkspaceId: 'ws-tab011-dst'
    })

    const state = await getTabsState(window)
    const tab = state.tabs.find((t) => t.id === 'preserved')!
    expect(tab.workspaceId).toBe('ws-tab011-dst')
    expect(tab.content).toBe('payload')
    expect(tab.isDirty).toBe(true)
    expect(tab.cursorPosition).toEqual({ lineNumber: 7, column: 3 })
    expect(tab.scrollTop).toBe(250)
  })

  test.afterEach(async ({ window }) => {
    await resetTabs(window)
  })
})
