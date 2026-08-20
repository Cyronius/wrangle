// Traces: SBR-002 (canonical spec: specs/unified-sidebar/spec.md)
//
// Independent per-section collapse: toggleWorkspaceExpanded flips exactly one
// workspace's isExpanded flag — no accordion behavior.

import { describe, it, expect } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import workspacesReducer, {
  addWorkspace,
  toggleWorkspaceExpanded,
  setWorkspaceExpanded
} from '../../../src/renderer/src/store/workspacesSlice'
import { DEFAULT_WORKSPACE_ID, WorkspaceState } from '../../../src/shared/workspace-types'

function ws(id: string, rootPath: string | null, isExpanded = true): WorkspaceState {
  return { id, name: id, color: '#000', rootPath, isExpanded, showHiddenFiles: true }
}

function makeStore() {
  return configureStore({ reducer: { workspaces: workspacesReducer } })
}

const expandedById = (store: ReturnType<typeof makeStore>) =>
  Object.fromEntries(store.getState().workspaces.workspaces.map(w => [w.id, w.isExpanded]))

describe('SBR-002: independent section collapse', () => {
  it('toggleWorkspaceExpanded flips only the targeted workspace', () => {
    const store = makeStore()
    store.dispatch(addWorkspace(ws('ws-a', 'C:/a')))
    store.dispatch(addWorkspace(ws('ws-b', 'C:/b')))

    store.dispatch(toggleWorkspaceExpanded('ws-a'))
    expect(expandedById(store)).toEqual({
      [DEFAULT_WORKSPACE_ID]: true,
      'ws-a': false,
      'ws-b': true
    })

    store.dispatch(toggleWorkspaceExpanded('ws-a'))
    expect(expandedById(store)['ws-a']).toBe(true)
  })

  it('multiple sections can be collapsed at once (no accordion)', () => {
    const store = makeStore()
    store.dispatch(addWorkspace(ws('ws-a', 'C:/a')))
    store.dispatch(addWorkspace(ws('ws-b', 'C:/b')))

    store.dispatch(toggleWorkspaceExpanded('ws-a'))
    store.dispatch(toggleWorkspaceExpanded('ws-b'))
    store.dispatch(toggleWorkspaceExpanded(DEFAULT_WORKSPACE_ID))

    expect(expandedById(store)).toEqual({
      [DEFAULT_WORKSPACE_ID]: false,
      'ws-a': false,
      'ws-b': false
    })
  })

  it('setWorkspaceExpanded applies restore state per workspace', () => {
    const store = makeStore()
    store.dispatch(addWorkspace(ws('ws-a', 'C:/a')))
    store.dispatch(setWorkspaceExpanded({ id: 'ws-a', expanded: false }))
    store.dispatch(setWorkspaceExpanded({ id: DEFAULT_WORKSPACE_ID, expanded: false }))

    expect(expandedById(store)).toEqual({
      [DEFAULT_WORKSPACE_ID]: false,
      'ws-a': false
    })
  })
})
