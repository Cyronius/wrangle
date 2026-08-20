// Traces: KBD-004 (canonical spec: specs/keyboard-commands/spec.md)
//
// Regression for the Ctrl+PageDown / Ctrl+PageUp bug: the registry's
// nav.nextTab / nav.prevTab were calling `dispatch(nextTab())` with no
// argument, but the reducer requires a WorkspaceId payload. Matching
// keystrokes routed correctly but the active tab never changed.
//
// KBD-016's existing parametric test only proves the keystroke reaches a
// command's `execute`. It cannot catch a payload-shape bug like this. The
// test below wires a real Redux store and asserts observable state — i.e.,
// that the active tab id actually advances.

import { describe, it, expect, beforeEach } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import tabsReducer, { addTab, setActiveTab } from '../../../src/renderer/src/store/tabsSlice'
import layoutReducer from '../../../src/renderer/src/store/layoutSlice'
import workspacesReducer, { addWorkspace, setActiveWorkspace } from '../../../src/renderer/src/store/workspacesSlice'
import { commandMap, CommandContext } from '../../../src/renderer/src/commands/registry'
import { DEFAULT_WORKSPACE_ID, WorkspaceId, WorkspaceState } from '../../../src/shared/workspace-types'
import type { TabDocument } from '../../../src/renderer/src/store/tabsSlice'

function makeStore() {
  return configureStore({
    reducer: {
      tabs: tabsReducer,
      layout: layoutReducer,
      workspaces: workspacesReducer
    }
  })
}

type Store = ReturnType<typeof makeStore>

function makeTab(id: string, workspaceId: WorkspaceId): TabDocument {
  return {
    id,
    workspaceId,
    filename: `${id}.md`,
    content: '',
    isDirty: false
  }
}

function seedTabs(store: Store, workspaceId: WorkspaceId, ids: string[]): void {
  for (const id of ids) {
    store.dispatch(addTab(makeTab(id, workspaceId)))
  }
  store.dispatch(setActiveTab(ids[0]))
}

function makeWorkspace(id: WorkspaceId, name: string): WorkspaceState {
  return {
    id,
    name,
    color: '#000',
    rootPath: null,
    isExpanded: true,
    showHiddenFiles: false
  }
}

function buildCtx(store: Store): CommandContext {
  return {
    editor: null,
    dispatch: store.dispatch,
    getState: store.getState,
    handlers: {
      onFileNew: () => {},
      onFileOpen: () => {},
      onFileSave: () => {},
      onFileSaveAs: () => {},
      onCloseTab: () => {},
      onEditUndo: () => {},
      onEditRedo: () => {},
      onOpenPreferences: () => {},
      onOpenFolder: () => {},
      onOpenCommandPalette: () => {}
    }
  }
}

const activeTabFor = (store: Store, workspaceId: WorkspaceId): string | null =>
  store.getState().tabs.activeTabIdByWorkspace[workspaceId] ?? null

describe('nav.nextTab / nav.prevTab dispatch the correct workspace payload', () => {
  let store: Store

  beforeEach(() => {
    store = makeStore()
  })

  it('nav.nextTab advances the active tab in the active workspace', () => {
    seedTabs(store, DEFAULT_WORKSPACE_ID, ['a', 'b', 'c'])
    expect(activeTabFor(store, DEFAULT_WORKSPACE_ID)).toBe('a')

    commandMap.get('nav.nextTab')!.execute(buildCtx(store))
    expect(activeTabFor(store, DEFAULT_WORKSPACE_ID)).toBe('b')

    commandMap.get('nav.nextTab')!.execute(buildCtx(store))
    expect(activeTabFor(store, DEFAULT_WORKSPACE_ID)).toBe('c')
  })

  it('nav.nextTab wraps around past the last tab', () => {
    seedTabs(store, DEFAULT_WORKSPACE_ID, ['a', 'b'])
    store.dispatch(setActiveTab('b'))

    commandMap.get('nav.nextTab')!.execute(buildCtx(store))
    expect(activeTabFor(store, DEFAULT_WORKSPACE_ID)).toBe('a')
  })

  it('nav.prevTab moves backward and wraps before the first tab', () => {
    seedTabs(store, DEFAULT_WORKSPACE_ID, ['a', 'b', 'c'])
    store.dispatch(setActiveTab('b'))

    commandMap.get('nav.prevTab')!.execute(buildCtx(store))
    expect(activeTabFor(store, DEFAULT_WORKSPACE_ID)).toBe('a')

    // Wrap to last
    commandMap.get('nav.prevTab')!.execute(buildCtx(store))
    expect(activeTabFor(store, DEFAULT_WORKSPACE_ID)).toBe('c')
  })

  it('routes to the active workspace only, leaving other workspaces untouched', () => {
    // Two workspaces, each with two tabs. nav.nextTab must advance the
    // ACTIVE workspace's tab and not disturb the other workspace's memory
    // (WTB-009 / WTB-014).
    const wsA = DEFAULT_WORKSPACE_ID
    const wsB = 'ws-b'
    store.dispatch(addWorkspace(makeWorkspace(wsB, 'B')))
    seedTabs(store, wsA, ['a1', 'a2'])
    seedTabs(store, wsB, ['b1', 'b2'])
    store.dispatch(setActiveTab('a1'))
    store.dispatch(setActiveTab('b1'))
    store.dispatch(setActiveWorkspace(wsA))

    commandMap.get('nav.nextTab')!.execute(buildCtx(store))

    expect(activeTabFor(store, wsA)).toBe('a2')
    expect(activeTabFor(store, wsB)).toBe('b1')
  })
})
