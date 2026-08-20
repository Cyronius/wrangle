import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export type ViewMode = 'split' | 'editor-only' | 'preview-only'

interface LayoutState {
  viewMode: ViewMode
  splitRatio: number
  previewSync: boolean
  zoomLevel: number // 0 = 100%, positive = zoom in, negative = zoom out
  showOutline: boolean
  showToolbar: boolean
  showExplorer: boolean
}

const initialState: LayoutState = {
  viewMode: 'split',
  splitRatio: 0.5,
  previewSync: true,
  zoomLevel: 0,
  showOutline: false,
  showToolbar: true,
  showExplorer: true
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
    }
  }
})

export const {
  setViewMode, setSplitRatio, togglePreviewSync,
  zoomIn, zoomOut, resetZoom,
  toggleOutline, toggleToolbar, toggleExplorer
} = layoutSlice.actions
export default layoutSlice.reducer
