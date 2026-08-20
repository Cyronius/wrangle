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
  isExpanded: true,
  showHiddenFiles: true
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
        // Position among folder workspaces before removal, for the fallback below
        const folderIndex = state.workspaces
          .filter((w) => w.rootPath)
          .findIndex((w) => w.id === action.payload)

        state.workspaces.splice(index, 1)

        // If removed workspace was active, fall back to the nearest remaining
        // folder workspace (previous position), then the default workspace (SBR-004)
        if (state.activeWorkspaceId === action.payload) {
          const remaining = state.workspaces.filter((w) => w.rootPath)
          const fallback =
            remaining[Math.max(0, Math.min(folderIndex - 1, remaining.length - 1))]
          state.activeWorkspaceId = fallback ? fallback.id : DEFAULT_WORKSPACE_ID
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

    // SBR-002: independent per-section collapse toggle
    toggleWorkspaceExpanded(state, action: PayloadAction<WorkspaceId>) {
      const workspace = state.workspaces.find((w) => w.id === action.payload)
      if (workspace) {
        workspace.isExpanded = !workspace.isExpanded
      }
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
    },

    // Reorder workspaces by moving item from oldIndex to newIndex
    reorderWorkspaces(state, action: PayloadAction<{ oldIndex: number; newIndex: number }>) {
      const { oldIndex, newIndex } = action.payload
      if (oldIndex === newIndex) return
      const [moved] = state.workspaces.splice(oldIndex, 1)
      state.workspaces.splice(newIndex, 0, moved)
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

// Pure: the folder-backed workspace whose rootPath is an ancestor of filePath,
// or null if none contains it. First match wins. Used to place OS-opened files
// (FIO-010) and as the basis for selectWorkspaceForPath.
export function findFolderWorkspaceForPath(
  workspaces: WorkspaceState[],
  filePath: string | undefined
): WorkspaceState | null {
  if (!filePath) return null

  // Normalize path separators for comparison
  const normalizedFilePath = filePath.replace(/\\/g, '/')

  // Only folder-backed workspaces (non-null rootPath) can own a path
  for (const workspace of workspaces) {
    if (workspace.rootPath) {
      const normalizedRootPath = workspace.rootPath.replace(/\\/g, '/')
      if (normalizedFilePath.startsWith(normalizedRootPath + '/')) {
        return workspace
      }
    }
  }

  return null
}

// Find workspace that contains a given file path, falling back to the default workspace
export const selectWorkspaceForPath = (state: RootState, filePath: string | undefined) => {
  return findFolderWorkspaceForPath(state.workspaces.workspaces, filePath) ?? selectDefaultWorkspace(state)
}

export const {
  addWorkspace,
  removeWorkspace,
  setActiveWorkspace,
  updateWorkspace,
  setWorkspaceExpanded,
  toggleWorkspaceExpanded,
  loadWorkspaces,
  reorderWorkspaces
} = workspacesSlice.actions

export default workspacesSlice.reducer
