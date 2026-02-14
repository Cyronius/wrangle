import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { WorkspaceId } from '../../../shared/workspace-types'

export type ViewMode = 'split' | 'editor-only' | 'preview-only'

interface LayoutState {
  viewMode: ViewMode
  splitRatio: number
  previewSync: boolean
  zoomLevel: number // 0 = 100%, positive = zoom in, negative = zoom out
  showOutline: boolean
  showToolbar: boolean
  showExplorer: boolean
  showWorkspaceSidebar: boolean
  // Multi-pane state (derived from visible workspaces, not toggled)
  focusedPaneId: WorkspaceId | null
  paneViewModes: Record<WorkspaceId, ViewMode>
  paneSplitRatios: Record<WorkspaceId, number>
  paneSizes: number[] // raw pixel widths from Allotment onChange
}

const initialState: LayoutState = {
  viewMode: 'split',
  splitRatio: 0.5,
  previewSync: true,
  zoomLevel: 0,
  showOutline: false,
  showToolbar: true,
  showExplorer: true,
  showWorkspaceSidebar: false,
  focusedPaneId: null,
  paneViewModes: {},
  paneSplitRatios: {},
  paneSizes: []
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
    toggleToolbar(state) {
      state.showToolbar = !state.showToolbar
    },
    toggleExplorer(state) {
      state.showExplorer = !state.showExplorer
    },
    toggleWorkspaceSidebar(state) {
      state.showWorkspaceSidebar = !state.showWorkspaceSidebar
    },
    setWorkspaceSidebar(state, action: PayloadAction<boolean>) {
      state.showWorkspaceSidebar = action.payload
    },
    setFocusedPane(state, action: PayloadAction<WorkspaceId>) {
      state.focusedPaneId = action.payload
    },
    setPaneViewMode(state, action: PayloadAction<{ paneId: WorkspaceId; viewMode: ViewMode }>) {
      state.paneViewModes[action.payload.paneId] = action.payload.viewMode
    },
    setPaneSplitRatio(state, action: PayloadAction<{ paneId: WorkspaceId; ratio: number }>) {
      state.paneSplitRatios[action.payload.paneId] = Math.max(0.2, Math.min(0.8, action.payload.ratio))
    },
    setPaneSizes(state, action: PayloadAction<number[]>) {
      state.paneSizes = action.payload
    }
  }
})

export const {
  setViewMode, setSplitRatio, togglePreviewSync,
  zoomIn, zoomOut, resetZoom,
  toggleOutline, toggleToolbar, toggleExplorer, toggleWorkspaceSidebar, setWorkspaceSidebar,
  setFocusedPane,
  setPaneViewMode, setPaneSplitRatio, setPaneSizes
} = layoutSlice.actions
export default layoutSlice.reducer
