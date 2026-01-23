import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { WorkspaceId, DEFAULT_WORKSPACE_ID } from '../../../shared/workspace-types'
import type { RootState } from './store'

export interface TabDocument {
  id: string
  workspaceId: WorkspaceId
  path?: string
  filename: string
  content: string
  isDirty: boolean
  displayTitle?: string // H1 heading for unsaved files
  cursorPosition?: { lineNumber: number; column: number }
  scrollTop?: number
}

interface TabsState {
  tabs: TabDocument[]
  // Track active tab per workspace
  activeTabIdByWorkspace: Record<WorkspaceId, string | null>
}

const initialState: TabsState = {
  tabs: [],
  activeTabIdByWorkspace: {
    [DEFAULT_WORKSPACE_ID]: null
  }
}

const tabsSlice = createSlice({
  name: 'tabs',
  initialState,
  reducers: {
    addTab(state, action: PayloadAction<TabDocument>) {
      state.tabs.push(action.payload)
      // Set as active tab for its workspace
      state.activeTabIdByWorkspace[action.payload.workspaceId] = action.payload.id
    },

    closeTab(state, action: PayloadAction<string>) {
      const tabIndex = state.tabs.findIndex((tab) => tab.id === action.payload)
      if (tabIndex === -1) return

      const tab = state.tabs[tabIndex]
      const workspaceId = tab.workspaceId

      state.tabs.splice(tabIndex, 1)

      // If this was the active tab for its workspace, select another tab in same workspace
      if (state.activeTabIdByWorkspace[workspaceId] === action.payload) {
        const remainingTabs = state.tabs.filter((t) => t.workspaceId === workspaceId)
        state.activeTabIdByWorkspace[workspaceId] =
          remainingTabs.length > 0 ? remainingTabs[0].id : null
      }
    },

    setActiveTab(state, action: PayloadAction<string>) {
      const tab = state.tabs.find((t) => t.id === action.payload)
      if (tab) {
        state.activeTabIdByWorkspace[tab.workspaceId] = action.payload
      }
    },

    updateTab(state, action: PayloadAction<Partial<TabDocument> & { id: string }>) {
      const tab = state.tabs.find((t) => t.id === action.payload.id)
      if (tab) {
        Object.assign(tab, action.payload)
      }
    },

    // Update cursor position for a tab
    updateTabPosition(
      state,
      action: PayloadAction<{
        id: string
        cursorPosition: { lineNumber: number; column: number }
      }>
    ) {
      const tab = state.tabs.find((t) => t.id === action.payload.id)
      if (tab) {
        tab.cursorPosition = action.payload.cursorPosition
      }
    },

    // Update scroll position for a tab
    updateTabScroll(state, action: PayloadAction<{ id: string; scrollTop: number }>) {
      const tab = state.tabs.find((t) => t.id === action.payload.id)
      if (tab) {
        tab.scrollTop = action.payload.scrollTop
      }
    },

    // Move a tab to a different workspace
    moveTabToWorkspace(
      state,
      action: PayloadAction<{ tabId: string; newWorkspaceId: WorkspaceId }>
    ) {
      const tab = state.tabs.find((t) => t.id === action.payload.tabId)
      if (!tab) return

      const oldWorkspaceId = tab.workspaceId

      // Update tab's workspace
      tab.workspaceId = action.payload.newWorkspaceId

      // If this was active in old workspace, clear it and select another
      if (state.activeTabIdByWorkspace[oldWorkspaceId] === action.payload.tabId) {
        const remainingTabs = state.tabs.filter(
          (t) => t.workspaceId === oldWorkspaceId && t.id !== action.payload.tabId
        )
        state.activeTabIdByWorkspace[oldWorkspaceId] =
          remainingTabs.length > 0 ? remainingTabs[0].id : null
      }

      // Set as active in new workspace
      state.activeTabIdByWorkspace[action.payload.newWorkspaceId] = action.payload.tabId
    },

    // Close all tabs in a workspace
    closeTabsByWorkspace(state, action: PayloadAction<WorkspaceId>) {
      state.tabs = state.tabs.filter((t) => t.workspaceId !== action.payload)
      state.activeTabIdByWorkspace[action.payload] = null
    },

    // Navigate to next tab within the same workspace
    nextTab(state, action: PayloadAction<WorkspaceId>) {
      const workspaceId = action.payload
      const workspaceTabs = state.tabs.filter((t) => t.workspaceId === workspaceId)
      if (workspaceTabs.length <= 1) return

      const activeTabId = state.activeTabIdByWorkspace[workspaceId]
      const currentIndex = workspaceTabs.findIndex((t) => t.id === activeTabId)
      const nextIndex = (currentIndex + 1) % workspaceTabs.length
      state.activeTabIdByWorkspace[workspaceId] = workspaceTabs[nextIndex].id
    },

    // Navigate to previous tab within the same workspace
    previousTab(state, action: PayloadAction<WorkspaceId>) {
      const workspaceId = action.payload
      const workspaceTabs = state.tabs.filter((t) => t.workspaceId === workspaceId)
      if (workspaceTabs.length <= 1) return

      const activeTabId = state.activeTabIdByWorkspace[workspaceId]
      const currentIndex = workspaceTabs.findIndex((t) => t.id === activeTabId)
      const prevIndex = currentIndex === 0 ? workspaceTabs.length - 1 : currentIndex - 1
      state.activeTabIdByWorkspace[workspaceId] = workspaceTabs[prevIndex].id
    },

    // Initialize active tab tracking for a new workspace
    initWorkspaceActiveTab(state, action: PayloadAction<WorkspaceId>) {
      if (!(action.payload in state.activeTabIdByWorkspace)) {
        state.activeTabIdByWorkspace[action.payload] = null
      }
    },

    // Clean up active tab tracking when workspace is removed
    cleanupWorkspaceActiveTab(state, action: PayloadAction<WorkspaceId>) {
      delete state.activeTabIdByWorkspace[action.payload]
    },

    // Reorder tabs within a workspace
    reorderTabs(state, action: PayloadAction<{ workspaceId: WorkspaceId; oldIndex: number; newIndex: number }>) {
      const { workspaceId, oldIndex, newIndex } = action.payload
      if (oldIndex === newIndex) return

      // Get indices of tabs belonging to this workspace in the global tabs array
      const workspaceTabs = state.tabs
        .map((tab, globalIndex) => ({ tab, globalIndex }))
        .filter(({ tab }) => tab.workspaceId === workspaceId)

      if (oldIndex >= workspaceTabs.length || newIndex >= workspaceTabs.length) return

      const sourceGlobalIndex = workspaceTabs[oldIndex].globalIndex
      const targetGlobalIndex = workspaceTabs[newIndex].globalIndex

      const [moved] = state.tabs.splice(sourceGlobalIndex, 1)
      // Recalculate target index after splice
      const adjustedTarget = targetGlobalIndex > sourceGlobalIndex ? targetGlobalIndex - 1 : targetGlobalIndex
      state.tabs.splice(adjustedTarget, 0, moved)
    }
  }
})

// Selectors
export const selectAllTabs = (state: RootState) => state.tabs.tabs

export const selectTabsByWorkspace = (state: RootState, workspaceId: WorkspaceId) => {
  return state.tabs.tabs.filter((t) => t.workspaceId === workspaceId)
}

export const selectActiveTabIdByWorkspace = (state: RootState, workspaceId: WorkspaceId) => {
  return state.tabs.activeTabIdByWorkspace[workspaceId] ?? null
}

export const selectActiveTabByWorkspace = (state: RootState, workspaceId: WorkspaceId) => {
  const activeTabId = state.tabs.activeTabIdByWorkspace[workspaceId]
  if (!activeTabId) return null
  return state.tabs.tabs.find((t) => t.id === activeTabId) ?? null
}

export const selectTabById = (state: RootState, tabId: string) => {
  return state.tabs.tabs.find((t) => t.id === tabId)
}

// For backwards compatibility - get active tab for active workspace
export const selectActiveTabId = (state: RootState) => {
  const activeWorkspaceId = state.workspaces?.activeWorkspaceId ?? DEFAULT_WORKSPACE_ID
  return state.tabs.activeTabIdByWorkspace[activeWorkspaceId] ?? null
}

export const selectActiveTab = (state: RootState) => {
  const activeTabId = selectActiveTabId(state)
  if (!activeTabId) return null
  return state.tabs.tabs.find((t) => t.id === activeTabId) ?? null
}

// Check if a file path is already open in any workspace
export const selectTabByPath = (state: RootState, filePath: string) => {
  return state.tabs.tabs.find((t) => t.path === filePath)
}

export const {
  addTab,
  closeTab,
  setActiveTab,
  updateTab,
  updateTabPosition,
  updateTabScroll,
  moveTabToWorkspace,
  closeTabsByWorkspace,
  nextTab,
  previousTab,
  initWorkspaceActiveTab,
  cleanupWorkspaceActiveTab,
  reorderTabs
} = tabsSlice.actions

export default tabsSlice.reducer
