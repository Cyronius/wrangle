// Traces: LYT-001 (canonical spec: specs/layout-view/spec.md)
//
// Ctrl+1 / Ctrl+2 / Ctrl+3 write the global `layout.viewMode`, which the
// single editor pane reads. (The former per-pane routing — LYT-006/LYT-008 —
// was deprecated by the unified-sidebar redesign; there is exactly one
// editor pane now.)

import { describe, it, expect } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import tabsReducer, { addTab, setActiveTab } from '../../../src/renderer/src/store/tabsSlice'
import layoutReducer, { setViewMode } from '../../../src/renderer/src/store/layoutSlice'
import workspacesReducer from '../../../src/renderer/src/store/workspacesSlice'
import settingsReducer from '../../../src/renderer/src/store/settingsSlice'
import { commandMap, CommandContext } from '../../../src/renderer/src/commands/registry'
import { DEFAULT_WORKSPACE_ID } from '../../../src/shared/workspace-types'
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

describe('LYT-001: Ctrl+1/2/3 update global viewMode', () => {
  it.each([
    { id: 'view.editorOnly', expected: 'editor-only' as const },
    { id: 'view.split', expected: 'split' as const },
    { id: 'view.previewOnly', expected: 'preview-only' as const }
  ])('$id writes to global layout.viewMode', ({ id, expected }) => {
    const store = makeStore()
    store.dispatch(addTab(makeTab('tab-1', DEFAULT_WORKSPACE_ID)))
    store.dispatch(setActiveTab('tab-1'))
    // Start from a known mode different from the target.
    store.dispatch(setViewMode(id === 'view.split' ? 'editor-only' : 'split'))

    const cmd = commandMap.get(id)!
    cmd.execute(makeContext(store))

    expect(store.getState().layout.viewMode).toBe(expected)
  })
})
