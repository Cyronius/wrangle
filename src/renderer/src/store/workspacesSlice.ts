import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import {
  WorkspaceId,
  WorkspaceState,
  DEFAULT_WORKSPACE_ID,
  WORKSPACE_COLORS
} from '../../../shared/workspace-types'
import type { RootState } from './store'

interface WorkspacesState {
  workspaces: WorkspaceState[]
  activeWorkspaceId: WorkspaceId
}

// Create default workspace at initialization
const defaultWorkspace: WorkspaceState = {
  id: DEFAULT_WORKSPACE_ID,
  name: 'Default',
  color: WORKSPACE_COLORS[0],
  rootPath: null,
  isExpanded: true
}

const initialState: WorkspacesState = {
  workspaces: [defaultWorkspace],
  activeWorkspaceId: DEFAULT_WORKSPACE_ID
}

const workspacesSlice = createSlice({
  name: 'workspaces',
  initialState,
  reducers: {
    addWorkspace(state, action: PayloadAction<WorkspaceState>) {
      // Check if workspace with same rootPath already exists
      const existing = state.workspaces.find(
        (w) => w.rootPath && w.rootPath === action.payload.rootPath
      )
      if (existing) {
        // Switch to existing workspace instead of adding duplicate
        state.activeWorkspaceId = existing.id
        return
      }
      state.workspaces.push(action.payload)
      state.activeWorkspaceId = action.payload.id
    },

    removeWorkspace(state, action: PayloadAction<WorkspaceId>) {
      // Cannot remove default workspace
      if (action.payload === DEFAULT_WORKSPACE_ID) return

      const index = state.workspaces.findIndex((w) => w.id === action.payload)
      if (index !== -1) {
        state.workspaces.splice(index, 1)

        // If removed workspace was active, switch to default
        if (state.activeWorkspaceId === action.payload) {
          state.activeWorkspaceId = DEFAULT_WORKSPACE_ID
        }
      }
    },

    setActiveWorkspace(state, action: PayloadAction<WorkspaceId>) {
      const exists = state.workspaces.some((w) => w.id === action.payload)
      if (exists) {
        state.activeWorkspaceId = action.payload
      }
    },

    updateWorkspace(
      state,
      action: PayloadAction<{ id: WorkspaceId; changes: Partial<Omit<WorkspaceState, 'id'>> }>
    ) {
      const workspace = state.workspaces.find((w) => w.id === action.payload.id)
      if (workspace) {
        Object.assign(workspace, action.payload.changes)
      }
    },

    setWorkspaceExpanded(state, action: PayloadAction<{ id: WorkspaceId; expanded: boolean }>) {
      const workspace = state.workspaces.find((w) => w.id === action.payload.id)
      if (workspace) {
        workspace.isExpanded = action.payload.expanded
      }
    },

    // Collapse all other workspaces when expanding one
    expandWorkspaceExclusive(state, action: PayloadAction<WorkspaceId>) {
      state.workspaces.forEach((w) => {
        w.isExpanded = w.id === action.payload
      })
    },

    collapseAllWorkspaces(state) {
      state.workspaces.forEach((w) => {
        w.isExpanded = false
      })
    },

    // Bulk load workspaces at app startup
    loadWorkspaces(state, action: PayloadAction<WorkspaceState[]>) {
      // Ensure default workspace is always present
      const hasDefault = action.payload.some((w) => w.id === DEFAULT_WORKSPACE_ID)
      if (hasDefault) {
        state.workspaces = action.payload
      } else {
        state.workspaces = [defaultWorkspace, ...action.payload]
      }
    }
  }
})

// Selectors
export const selectAllWorkspaces = (state: RootState) => state.workspaces.workspaces

export const selectActiveWorkspace = (state: RootState) => {
  return state.workspaces.workspaces.find((w) => w.id === state.workspaces.activeWorkspaceId)
}

export const selectActiveWorkspaceId = (state: RootState) => state.workspaces.activeWorkspaceId

export const selectWorkspaceById = (state: RootState, id: WorkspaceId) => {
  return state.workspaces.workspaces.find((w) => w.id === id)
}

export const selectDefaultWorkspace = (state: RootState) => {
  return state.workspaces.workspaces.find((w) => w.id === DEFAULT_WORKSPACE_ID)
}

export const selectNonDefaultWorkspaces = (state: RootState) => {
  return state.workspaces.workspaces.filter((w) => w.id !== DEFAULT_WORKSPACE_ID)
}

// Find workspace that contains a given file path
export const selectWorkspaceForPath = (state: RootState, filePath: string | undefined) => {
  if (!filePath) return selectDefaultWorkspace(state)

  // Normalize path separators for comparison
  const normalizedFilePath = filePath.replace(/\\/g, '/')

  // Check non-default workspaces first (they have rootPath)
  for (const workspace of state.workspaces.workspaces) {
    if (workspace.rootPath) {
      const normalizedRootPath = workspace.rootPath.replace(/\\/g, '/')
      if (normalizedFilePath.startsWith(normalizedRootPath + '/')) {
        return workspace
      }
    }
  }

  // Default to default workspace
  return selectDefaultWorkspace(state)
}

export const {
  addWorkspace,
  removeWorkspace,
  setActiveWorkspace,
  updateWorkspace,
  setWorkspaceExpanded,
  expandWorkspaceExclusive,
  collapseAllWorkspaces,
  loadWorkspaces
} = workspacesSlice.actions

export default workspacesSlice.reducer
