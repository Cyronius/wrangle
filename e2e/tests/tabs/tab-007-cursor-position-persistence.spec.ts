// Traces: TAB-007 (canonical spec: specs/tabs/spec.md)
import { test, expect, waitForAppReady } from '../../fixtures'
import {
  addTab,
  addWorkspace,
  dispatchAction,
  getTabsState,
  initWorkspace,
  resetTabs
} from '../../helpers/tab-state-helpers'

test.describe('TAB-007: Cursor Position Persistence Per Tab', () => {
  test.beforeEach(async ({ window }) => {
    await waitForAppReady(window)
    await resetTabs(window)
    await addWorkspace(window, { id: 'ws-tab007', name: 'CURSOR' })
    await initWorkspace(window, 'ws-tab007')
  })

  test('updateTabPosition stores cursorPosition on the tab', async ({ window }) => {
    await addTab(window, {
      id: 'cur1',
      workspaceId: 'ws-tab007',
      filename: 'doc.md',
      content: 'line 1\nline 2\nline 3\n'
    })

    await dispatchAction(window, 'tabs/updateTabPosition', {
      id: 'cur1',
      cursorPosition: { lineNumber: 2, column: 4 }
    })

    const state = await getTabsState(window)
    const tab = state.tabs.find((t) => t.id === 'cur1')!
    expect(tab.cursorPosition).toEqual({ lineNumber: 2, column: 4 })
  })

  test('per-tab cursor positions are independent', async ({ window }) => {
    await addTab(window, { id: 'a', workspaceId: 'ws-tab007', filename: 'a.md', content: 'aaa' })
    await addTab(window, { id: 'b', workspaceId: 'ws-tab007', filename: 'b.md', content: 'bbb' })

    await dispatchAction(window, 'tabs/updateTabPosition', {
      id: 'a',
      cursorPosition: { lineNumber: 1, column: 2 }
    })
    await dispatchAction(window, 'tabs/updateTabPosition', {
      id: 'b',
      cursorPosition: { lineNumber: 5, column: 10 }
    })

    const state = await getTabsState(window)
    expect(state.tabs.find((t) => t.id === 'a')!.cursorPosition).toEqual({
      lineNumber: 1,
      column: 2
    })
    expect(state.tabs.find((t) => t.id === 'b')!.cursorPosition).toEqual({
      lineNumber: 5,
      column: 10
    })
  })

  test('cursorPosition is undefined on a fresh tab', async ({ window }) => {
    await addTab(window, {
      id: 'fresh',
      workspaceId: 'ws-tab007',
      filename: 'fresh.md',
      content: ''
    })
    const state = await getTabsState(window)
    expect(state.tabs.find((t) => t.id === 'fresh')!.cursorPosition).toBeUndefined()
  })

  test('switching tabs preserves each tab\'s stored cursor position', async ({ window }) => {
    await addTab(window, {
      id: 'tabA',
      workspaceId: 'ws-tab007',
      filename: 'a.md',
      content: 'hello\nworld'
    })
    await addTab(window, {
      id: 'tabB',
      workspaceId: 'ws-tab007',
      filename: 'b.md',
      content: 'another\nfile\nhere'
    })

    await dispatchAction(window, 'tabs/updateTabPosition', {
      id: 'tabA',
      cursorPosition: { lineNumber: 2, column: 3 }
    })
    await dispatchAction(window, 'tabs/updateTabPosition', {
      id: 'tabB',
      cursorPosition: { lineNumber: 3, column: 1 }
    })

    // Switch activation back and forth
    await dispatchAction(window, 'tabs/setActiveTab', 'tabA')
    await dispatchAction(window, 'tabs/setActiveTab', 'tabB')
    await dispatchAction(window, 'tabs/setActiveTab', 'tabA')

    const state = await getTabsState(window)
    expect(state.tabs.find((t) => t.id === 'tabA')!.cursorPosition).toEqual({
      lineNumber: 2,
      column: 3
    })
    expect(state.tabs.find((t) => t.id === 'tabB')!.cursorPosition).toEqual({
      lineNumber: 3,
      column: 1
    })
  })

  test.afterEach(async ({ window }) => {
    await resetTabs(window)
  })
})
