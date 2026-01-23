import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export type ViewMode = 'split' | 'editor-only' | 'preview-only'

interface LayoutState {
  viewMode: ViewMode
  splitRatio: number
  previewSync: boolean
  zoomLevel: number // 0 = 100%, positive = zoom in, negative = zoom out
  showOutline: boolean
  showWorkspaceSidebar: boolean
}

const initialState: LayoutState = {
  viewMode: 'split',
  splitRatio: 0.5,
  previewSync: true,
  zoomLevel: 0,
  showOutline: false,
  showWorkspaceSidebar: false
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
      // Max zoom level of 5 (roughly 150% at 10% per level)
      state.zoomLevel = Math.min(5, state.zoomLevel + 1)
    },
    zoomOut(state) {
      // Min zoom level of -5 (roughly 50% at 10% per level)
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
    }
  }
})

export const { setViewMode, setSplitRatio, togglePreviewSync, zoomIn, zoomOut, resetZoom, toggleOutline, toggleWorkspaceSidebar, setWorkspaceSidebar } = layoutSlice.actions
export default layoutSlice.reducer
