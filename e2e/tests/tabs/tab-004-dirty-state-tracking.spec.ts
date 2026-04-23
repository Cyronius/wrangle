// Traces: TAB-004 (canonical spec: specs/tabs/spec.md)
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

test.describe('TAB-004: Dirty State Tracking', () => {
  test.beforeEach(async ({ window }) => {
    await waitForAppReady(window)
    await resetTabs(window)
    await addWorkspace(window, { id: 'ws-tab004', name: 'DIRTY' })
    await initWorkspace(window, 'ws-tab004')
  })

  test('updateTab with isDirty:true marks the tab dirty (and the UI shows the indicator)', async ({
    window
  }) => {
    await addTab(window, {
      id: 'd1',
      workspaceId: 'ws-tab004',
      filename: 'clean.md',
      content: '',
      isDirty: false
    })

    let dom = await getDomTabs(window, 'ws-tab004')
    expect(dom[0].isDirty).toBe(false)

    await dispatchAction(window, 'tabs/updateTab', {
      id: 'd1',
      content: 'typed content',
      isDirty: true
    })

    const state = await getTabsState(window)
    const tab = state.tabs.find((t) => t.id === 'd1')!
    expect(tab.isDirty).toBe(true)
    expect(tab.content).toBe('typed content')

    dom = await getDomTabs(window, 'ws-tab004')
    expect(dom[0].isDirty).toBe(true)
  })

  test('updateTab with isDirty:false clears dirty (simulating a save)', async ({ window }) => {
    await addTab(window, {
      id: 'd2',
      workspaceId: 'ws-tab004',
      filename: 'doc.md',
      content: 'edited',
      isDirty: true
    })

    let dom = await getDomTabs(window, 'ws-tab004')
    expect(dom[0].isDirty).toBe(true)

    await dispatchAction(window, 'tabs/updateTab', { id: 'd2', isDirty: false })

    const state = await getTabsState(window)
    expect(state.tabs.find((t) => t.id === 'd2')!.isDirty).toBe(false)

    dom = await getDomTabs(window, 'ws-tab004')
    expect(dom[0].isDirty).toBe(false)
  })

  test('dirty state is per-tab and independent of workspace activity', async ({ window }) => {
    await addTab(window, {
      id: 'dirty-one',
      workspaceId: 'ws-tab004',
      filename: 'dirty.md',
      isDirty: true
    })
    await addTab(window, {
      id: 'clean-one',
      workspaceId: 'ws-tab004',
      filename: 'clean.md',
      isDirty: false
    })

    // clean-one is active (last added). Dirty state on dirty-one must persist.
    const state = await getTabsState(window)
    expect(state.activeTabIdByWorkspace['ws-tab004']).toBe('clean-one')
    expect(state.tabs.find((t) => t.id === 'dirty-one')!.isDirty).toBe(true)
    expect(state.tabs.find((t) => t.id === 'clean-one')!.isDirty).toBe(false)

    const dom = await getDomTabs(window, 'ws-tab004')
    const dirtyTab = dom.find((t) => t.label === 'dirty.md')!
    const cleanTab = dom.find((t) => t.label === 'clean.md')!
    expect(dirtyTab.isDirty).toBe(true)
    expect(cleanTab.isDirty).toBe(false)
    // Switching active should not flip dirty state
    await dispatchAction(window, 'tabs/setActiveTab', 'dirty-one')
    const state2 = await getTabsState(window)
    expect(state2.tabs.find((t) => t.id === 'dirty-one')!.isDirty).toBe(true)
    expect(state2.tabs.find((t) => t.id === 'clean-one')!.isDirty).toBe(false)
  })

  test.afterEach(async ({ window }) => {
    await resetTabs(window)
  })
})
