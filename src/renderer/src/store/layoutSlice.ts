import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { WorkspaceId } from '../../../shared/workspace-types'

export type ViewMode = 'split' | 'editor-only' | 'preview-only'

interface LayoutState {
  viewMode: ViewMode
  splitRatio: number
  previewSync: boolean
  zoomLevel: number // 0 = 100%, positive = zoom in, negative = zoom out
  showOutline: boolean
  showWorkspaceSidebar: boolean
  // Multi-pane mode
  multiPaneEnabled: boolean
  focusedPaneId: WorkspaceId | null
  visiblePanes: WorkspaceId[]
  paneViewModes: Record<WorkspaceId, ViewMode>
  paneSplitRatios: Record<WorkspaceId, number>
}

const initialState: LayoutState = {
  viewMode: 'split',
  splitRatio: 0.5,
  previewSync: true,
  zoomLevel: 0,
  showOutline: false,
  showWorkspaceSidebar: false,
  multiPaneEnabled: false,
  focusedPaneId: null,
  visiblePanes: [],
  paneViewModes: {},
  paneSplitRatios: {}
}

const layoutSlice = createSlice({
  name: 'layout',
  initialState,
  reducers: {
    setViewMode(state, action: PayloadAction<ViewMode>) {
      state.viewMode = action.payload
    },
    setSplitRatio(state, action: PayloadAction<number>) {
      state.splitRatio = Math.max(0.2, Math.min(0.8, action.payload))
    },
    togglePreviewSync(state) {
      state.previewSync = !state.previewSync
    },
    zoomIn(state) {
      state.zoomLevel = Math.min(5, state.zoomLevel + 1)
    },
    zoomOut(state) {
      state.zoomLevel = Math.max(-5, state.zoomLevel - 1)
    },
    resetZoom(state) {
      state.zoomLevel = 0
    },
    toggleOutline(state) {
      state.showOutline = !state.showOutline
    },
    toggleWorkspaceSidebar(state) {
      state.showWorkspaceSidebar = !state.showWorkspaceSidebar
    },
    setWorkspaceSidebar(state, action: PayloadAction<boolean>) {
      state.showWorkspaceSidebar = action.payload
    },
    // Multi-pane reducers
    toggleMultiPane(state, action: PayloadAction<WorkspaceId[] | undefined>) {
      state.multiPaneEnabled = !state.multiPaneEnabled
      if (state.multiPaneEnabled) {
        // When enabling, populate visiblePanes with provided workspaces
        if (action.payload && action.payload.length > 0) {
          state.visiblePanes = action.payload
          state.focusedPaneId = action.payload[0]
        }
      } else {
        // When disabling, keep focusedPaneId as active workspace
        state.visiblePanes = []
        state.focusedPaneId = null
      }
    },
    setFocusedPane(state, action: PayloadAction<WorkspaceId>) {
      state.focusedPaneId = action.payload
    },
    addVisiblePane(state, action: PayloadAction<WorkspaceId>) {
      if (!state.visiblePanes.includes(action.payload)) {
        state.visiblePanes.push(action.payload)
      }
      state.focusedPaneId = action.payload
    },
    removeVisiblePane(state, action: PayloadAction<WorkspaceId>) {
      state.visiblePanes = state.visiblePanes.filter(id => id !== action.payload)
      // If we removed the focused pane, focus the first remaining
      if (state.focusedPaneId === action.payload) {
        state.focusedPaneId = state.visiblePanes[0] ?? null
      }
      // If no panes left, disable multi-pane mode
      if (state.visiblePanes.length === 0) {
        state.multiPaneEnabled = false
      }
    },
    setPaneViewMode(state, action: PayloadAction<{ paneId: WorkspaceId; viewMode: ViewMode }>) {
      state.paneViewModes[action.payload.paneId] = action.payload.viewMode
    },
    setPaneSplitRatio(state, action: PayloadAction<{ paneId: WorkspaceId; ratio: number }>) {
      state.paneSplitRatios[action.payload.paneId] = Math.max(0.2, Math.min(0.8, action.payload.ratio))
    }
  }
})

export const {
  setViewMode, setSplitRatio, togglePreviewSync,
  zoomIn, zoomOut, resetZoom,
  toggleOutline, toggleWorkspaceSidebar, setWorkspaceSidebar,
  toggleMultiPane, setFocusedPane, addVisiblePane, removeVisiblePane,
  setPaneViewMode, setPaneSplitRatio
} = layoutSlice.actions
export default layoutSlice.reducer
