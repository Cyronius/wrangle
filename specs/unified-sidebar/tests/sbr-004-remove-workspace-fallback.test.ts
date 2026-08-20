// Traces: SBR-004 (canonical spec: specs/unified-sidebar/spec.md)
//
// Closing the active workspace falls back to the nearest remaining folder
// workspace (previous position), then the default workspace.

import { describe, it, expect } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import workspacesReducer, {
  addWorkspace,
  removeWorkspace,
  setActiveWorkspace
} from '../../../src/renderer/src/store/workspacesSlice'
import { DEFAULT_WORKSPACE_ID, WorkspaceState } from '../../../src/shared/workspace-types'

function ws(id: string, rootPath: string): WorkspaceState {
  return { id, name: id, color: '#000', rootPath, isExpanded: true, showHiddenFiles: true }
}

function makeStore(ids: string[]) {
  const store = configureStore({ reducer: { workspaces: workspacesReducer } })
  for (const id of ids) store.dispatch(addWorkspace(ws(id, `C:/${id}`)))
  return store
}

const activeId = (store: ReturnType<typeof makeStore>) =>
  store.getState().workspaces.activeWorkspaceId

describe('SBR-004: removeWorkspace active-workspace fallback', () => {
  it('falls back to the previous folder workspace', () => {
    const store = makeStore(['ws-a', 'ws-b', 'ws-c'])
    store.dispatch(setActiveWorkspace('ws-b'))
    store.dispatch(removeWorkspace('ws-b'))
    expect(activeId(store)).toBe('ws-a')
  })

  it('falls back to the next folder workspace when the first is removed', () => {
    const store = makeStore(['ws-a', 'ws-b'])
    store.dispatch(setActiveWorkspace('ws-a'))
    store.dispatch(removeWorkspace('ws-a'))
    expect(activeId(store)).toBe('ws-b')
  })

  it('falls back to the default workspace when no folder workspace remains', () => {
    const store = makeStore(['ws-a'])
    store.dispatch(setActiveWorkspace('ws-a'))
    store.dispatch(removeWorkspace('ws-a'))
    expect(activeId(store)).toBe(DEFAULT_WORKSPACE_ID)
  })

  it('does not change the active workspace when a non-active one is removed', () => {
    const store = makeStore(['ws-a', 'ws-b'])
    store.dispatch(setActiveWorkspace('ws-a'))
    store.dispatch(removeWorkspace('ws-b'))
    expect(activeId(store)).toBe('ws-a')
  })

  it('never removes the default workspace', () => {
    const store = makeStore([])
    store.dispatch(removeWorkspace(DEFAULT_WORKSPACE_ID))
    expect(store.getState().workspaces.workspaces).toHaveLength(1)
  })
})
