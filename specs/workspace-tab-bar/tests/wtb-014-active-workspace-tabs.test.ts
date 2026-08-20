// Traces: WTB-014, WTB-009 (canonical spec: specs/workspace-tab-bar/spec.md)
//
// The tab bar renders only the active workspace's tabs (WTB-014), and each
// workspace remembers its own active tab across switches (WTB-009).

import { describe, it, expect } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import tabsReducer, {
  addTab,
  setActiveTab,
  selectActiveWorkspaceTabs,
  selectActiveTab
} from '../../../src/renderer/src/store/tabsSlice'
import workspacesReducer, {
  addWorkspace,
  setActiveWorkspace
} from '../../../src/renderer/src/store/workspacesSlice'
import { WorkspaceState } from '../../../src/shared/workspace-types'
import type { TabDocument } from '../../../src/renderer/src/store/tabsSlice'
import type { RootState } from '../../../src/renderer/src/store/store'

function ws(id: string): WorkspaceState {
  return { id, name: id, color: '#000', rootPath: `C:/${id}`, isExpanded: true, showHiddenFiles: true }
}

function tab(id: string, workspaceId: string): TabDocument {
  return { id, workspaceId, filename: `${id}.md`, content: '', isDirty: false, path: `C:/${workspaceId}/${id}.md` }
}

function makeStore() {
  return configureStore({ reducer: { tabs: tabsReducer, workspaces: workspacesReducer } })
}

const state = (store: ReturnType<typeof makeStore>) => store.getState() as unknown as RootState

describe('WTB-014: tab bar shows only the active workspace tabs', () => {
  it('selector returns only the active workspace tabs, in tab order', () => {
    const store = makeStore()
    store.dispatch(addWorkspace(ws('ws-a')))
    store.dispatch(addWorkspace(ws('ws-b')))
    store.dispatch(addTab(tab('a1', 'ws-a')))
    store.dispatch(addTab(tab('b1', 'ws-b')))
    store.dispatch(addTab(tab('a2', 'ws-a')))

    store.dispatch(setActiveWorkspace('ws-a'))
    expect(selectActiveWorkspaceTabs(state(store)).map(t => t.id)).toEqual(['a1', 'a2'])

    store.dispatch(setActiveWorkspace('ws-b'))
    expect(selectActiveWorkspaceTabs(state(store)).map(t => t.id)).toEqual(['b1'])
  })

  it('selector returns [] when the active workspace has no tabs', () => {
    const store = makeStore()
    store.dispatch(addWorkspace(ws('ws-empty')))
    store.dispatch(setActiveWorkspace('ws-empty'))
    expect(selectActiveWorkspaceTabs(state(store))).toEqual([])
  })

  // WTB-009
  it('each workspace remembers its own active tab across switches', () => {
    const store = makeStore()
    store.dispatch(addWorkspace(ws('ws-a')))
    store.dispatch(addWorkspace(ws('ws-b')))
    store.dispatch(addTab(tab('a1', 'ws-a')))
    store.dispatch(addTab(tab('a2', 'ws-a')))
    store.dispatch(addTab(tab('b1', 'ws-b')))
    store.dispatch(addTab(tab('b2', 'ws-b')))

    store.dispatch(setActiveWorkspace('ws-a'))
    store.dispatch(setActiveTab('a2'))
    store.dispatch(setActiveWorkspace('ws-b'))
    store.dispatch(setActiveTab('b1'))

    // Activating b1 did not disturb ws-a's memory
    expect(state(store).tabs.activeTabIdByWorkspace['ws-a']).toBe('a2')

    store.dispatch(setActiveWorkspace('ws-a'))
    expect(selectActiveTab(state(store))?.id).toBe('a2')

    store.dispatch(setActiveWorkspace('ws-b'))
    expect(selectActiveTab(state(store))?.id).toBe('b1')
  })
})
