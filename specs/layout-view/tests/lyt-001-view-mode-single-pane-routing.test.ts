// Traces: LYT-001, LYT-006, LYT-008 (canonical spec: specs/layout-view/spec.md)
//
// Regression for the Ctrl+1 / Ctrl+2 / Ctrl+3 bug: clicking any tab sets
// `layout.focusedPaneId`, so once a single-pane user clicks a tab the registry
// has a non-null `focusedPaneId`. The view-mode commands used to treat any
// non-null `focusedPaneId` as "multi-pane is active" and dispatch
// `setPaneViewMode`. But in single-pane mode the rendered `EditorLayout` reads
// only the global `state.layout.viewMode` — so the per-pane write was
// invisible and the keystroke appeared to do nothing.
//
// Per LYT-001 / LYT-006: per-pane view mode applies only when ≥2 workspace
// panes are visible. In single-pane mode the global `viewMode` is the source
// of truth and must update.

import { describe, it, expect } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import tabsReducer, { addTab, setActiveTab } from '../../../src/renderer/src/store/tabsSlice'
import layoutReducer, { setFocusedPane, setViewMode } from '../../../src/renderer/src/store/layoutSlice'
import workspacesReducer, { addWorkspace, setVisibleInTabBar } from '../../../src/renderer/src/store/workspacesSlice'
import settingsReducer from '../../../src/renderer/src/store/settingsSlice'
import { commandMap, CommandContext } from '../../../src/renderer/src/commands/registry'
import { DEFAULT_WORKSPACE_ID, WorkspaceState } from '../../../src/shared/workspace-types'
import type { TabDocument } from '../../../src/renderer/src/store/tabsSlice'

function makeStore() {
  return configureStore({
    reducer: {
      tabs: tabsReducer,
      layout: layoutReducer,
      workspaces: workspacesReducer,
      settings: settingsReducer
    }
  })
}

type Store = ReturnType<typeof makeStore>

function makeTab(id: string, workspaceId: string): TabDocument {
  return {
    id,
    workspaceId,
    filename: `${id}.md`,
    content: '',
    isDirty: false,
    path: `/tmp/${id}.md`
  }
}

function makeWorkspace(id: string, name: string): WorkspaceState {
  return {
    id,
    name,
    color: '#000',
    rootPath: null,
    isExpanded: true,
    showHiddenFiles: false,
    visibleInTabBar: true
  }
}

function makeContext(store: Store): CommandContext {
  return {
    editor: null,
    dispatch: store.dispatch as (action: unknown) => void,
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

describe('LYT-001: Ctrl+1/2/3 update global viewMode in single-pane mode', () => {
  it.each([
    { id: 'view.editorOnly', expected: 'editor-only' as const },
    { id: 'view.split', expected: 'split' as const },
    { id: 'view.previewOnly', expected: 'preview-only' as const }
  ])('$id writes to global layout.viewMode, not paneViewModes', ({ id, expected }) => {
    const store = makeStore()
    // Single-pane: only the default workspace is visible.
    store.dispatch(addTab(makeTab('tab-1', DEFAULT_WORKSPACE_ID)))
    store.dispatch(setActiveTab('tab-1'))
    // Simulate the click-a-tab flow: focusedPaneId is now set.
    store.dispatch(setFocusedPane(DEFAULT_WORKSPACE_ID))
    // Start from a known mode different from the target.
    store.dispatch(setViewMode(id === 'view.split' ? 'editor-only' : 'split'))

    const cmd = commandMap.get(id)!
    cmd.execute(makeContext(store))

    const layout = store.getState().layout
    expect(layout.viewMode).toBe(expected)
    expect(layout.paneViewModes[DEFAULT_WORKSPACE_ID]).toBeUndefined()
  })

  it('per-pane routing still applies when ≥2 workspaces are visible (LYT-006)', () => {
    const store = makeStore()
    store.dispatch(addWorkspace(makeWorkspace('ws-2', 'Second')))
    // Ensure both are marked visible.
    store.dispatch(setVisibleInTabBar({ id: DEFAULT_WORKSPACE_ID, visible: true }))
    store.dispatch(setVisibleInTabBar({ id: 'ws-2', visible: true }))
    store.dispatch(addTab(makeTab('tab-1', DEFAULT_WORKSPACE_ID)))
    store.dispatch(addTab(makeTab('tab-2', 'ws-2')))
    store.dispatch(setActiveTab('tab-2'))
    store.dispatch(setFocusedPane('ws-2'))

    commandMap.get('view.editorOnly')!.execute(makeContext(store))

    const layout = store.getState().layout
    // Per-pane updated for the focused pane.
    expect(layout.paneViewModes['ws-2']).toBe('editor-only')
    // Global viewMode untouched.
    expect(layout.viewMode).toBe('split')
    // Other pane untouched.
    expect(layout.paneViewModes[DEFAULT_WORKSPACE_ID]).toBeUndefined()
  })
})
