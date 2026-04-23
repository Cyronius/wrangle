// Traces: TAB-006 (canonical spec: specs/tabs/spec.md)
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

test.describe('TAB-006: Tab Context Menu Close Variants', () => {
  test.beforeEach(async ({ window }) => {
    await waitForAppReady(window)
    await resetTabs(window)
    await addWorkspace(window, { id: 'ws-tab006', name: 'CTX' })
    await addWorkspace(window, { id: 'ws-tab006-other', name: 'OTHER' })
    await initWorkspace(window, 'ws-tab006')
    await initWorkspace(window, 'ws-tab006-other')
  })

  test('Close: closeTab removes the target tab (see TAB-003)', async ({ window }) => {
    await addTab(window, { id: 'c1', workspaceId: 'ws-tab006', filename: 'c1.md' })
    await addTab(window, { id: 'c2', workspaceId: 'ws-tab006', filename: 'c2.md' })
    await dispatchAction(window, 'tabs/closeTab', 'c1')
    const dom = await getDomTabs(window, 'ws-tab006')
    expect(dom.map((t) => t.label)).toEqual(['c2.md'])
  })

  test('Close to the Left: removes all tabs preceding the target in the workspace', async ({
    window
  }) => {
    await addTab(window, { id: 'l1', workspaceId: 'ws-tab006', filename: 'l1.md' })
    await addTab(window, { id: 'l2', workspaceId: 'ws-tab006', filename: 'l2.md' })
    await addTab(window, { id: 'l3', workspaceId: 'ws-tab006', filename: 'l3.md' })
    await addTab(window, { id: 'l4', workspaceId: 'ws-tab006', filename: 'l4.md' })

    await dispatchAction(window, 'tabs/closeTabsToLeft', 'l3')

    const dom = await getDomTabs(window, 'ws-tab006')
    expect(dom.map((t) => t.label)).toEqual(['l3.md', 'l4.md'])
  })

  test('Close to the Left: target becomes active if active tab was among those removed', async ({
    window
  }) => {
    await addTab(window, { id: 'la1', workspaceId: 'ws-tab006', filename: 'la1.md' })
    await addTab(window, { id: 'la2', workspaceId: 'ws-tab006', filename: 'la2.md' })
    await addTab(window, { id: 'la3', workspaceId: 'ws-tab006', filename: 'la3.md' })
    // Set active to la1 (which will be removed)
    await dispatchAction(window, 'tabs/setActiveTab', 'la1')
    await dispatchAction(window, 'tabs/closeTabsToLeft', 'la3')

    const state = await getTabsState(window)
    expect(state.activeTabIdByWorkspace['ws-tab006']).toBe('la3')
  })

  test('Close to the Right: removes all tabs following the target in the workspace', async ({
    window
  }) => {
    await addTab(window, { id: 'r1', workspaceId: 'ws-tab006', filename: 'r1.md' })
    await addTab(window, { id: 'r2', workspaceId: 'ws-tab006', filename: 'r2.md' })
    await addTab(window, { id: 'r3', workspaceId: 'ws-tab006', filename: 'r3.md' })
    await addTab(window, { id: 'r4', workspaceId: 'ws-tab006', filename: 'r4.md' })

    await dispatchAction(window, 'tabs/closeTabsToRight', 'r2')

    const dom = await getDomTabs(window, 'ws-tab006')
    expect(dom.map((t) => t.label)).toEqual(['r1.md', 'r2.md'])
  })

  test('Close to the Right: target becomes active if active was among those removed', async ({
    window
  }) => {
    await addTab(window, { id: 'ra1', workspaceId: 'ws-tab006', filename: 'ra1.md' })
    await addTab(window, { id: 'ra2', workspaceId: 'ws-tab006', filename: 'ra2.md' })
    await addTab(window, { id: 'ra3', workspaceId: 'ws-tab006', filename: 'ra3.md' })
    // Active tab is ra3 (last added), which will be removed by closeTabsToRight(ra1)
    await dispatchAction(window, 'tabs/closeTabsToRight', 'ra1')

    const state = await getTabsState(window)
    expect(state.activeTabIdByWorkspace['ws-tab006']).toBe('ra1')
  })

  test('Close Others: left + right leaves only the target, which becomes active', async ({
    window
  }) => {
    await addTab(window, { id: 'o1', workspaceId: 'ws-tab006', filename: 'o1.md' })
    await addTab(window, { id: 'o2', workspaceId: 'ws-tab006', filename: 'o2.md' })
    await addTab(window, { id: 'o3', workspaceId: 'ws-tab006', filename: 'o3.md' })
    await addTab(window, { id: 'o4', workspaceId: 'ws-tab006', filename: 'o4.md' })

    await dispatchAction(window, 'tabs/closeTabsToLeft', 'o2')
    await dispatchAction(window, 'tabs/closeTabsToRight', 'o2')

    const dom = await getDomTabs(window, 'ws-tab006')
    expect(dom.map((t) => t.label)).toEqual(['o2.md'])

    const state = await getTabsState(window)
    expect(state.activeTabIdByWorkspace['ws-tab006']).toBe('o2')
  })

  test('close variants never affect tabs in other workspaces', async ({ window }) => {
    await addTab(window, { id: 'a1', workspaceId: 'ws-tab006', filename: 'a1.md' })
    await addTab(window, { id: 'a2', workspaceId: 'ws-tab006', filename: 'a2.md' })
    await addTab(window, { id: 'a3', workspaceId: 'ws-tab006', filename: 'a3.md' })
    await addTab(window, { id: 'other1', workspaceId: 'ws-tab006-other', filename: 'o1.md' })
    await addTab(window, { id: 'other2', workspaceId: 'ws-tab006-other', filename: 'o2.md' })

    await dispatchAction(window, 'tabs/closeTabsToLeft', 'a3')
    await dispatchAction(window, 'tabs/closeTabsToRight', 'a3')

    const otherDom = await getDomTabs(window, 'ws-tab006-other')
    expect(otherDom.map((t) => t.label)).toEqual(['o1.md', 'o2.md'])
  })

  test.afterEach(async ({ window }) => {
    await resetTabs(window)
  })
})
