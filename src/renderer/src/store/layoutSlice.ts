import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export type ViewMode = 'split' | 'editor-only' | 'preview-only'

interface LayoutState {
  viewMode: ViewMode
  splitRatio: number
  zoomLevel: number // 0 = 100%, positive = zoom in, negative = zoom out
  showOutline: boolean
}

const initialState: LayoutState = {
  viewMode: 'split',
  splitRatio: 0.5,
  zoomLevel: 0,
  showOutline: false
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
    }
  }
})

export const { setViewMode, setSplitRatio, zoomIn, zoomOut, resetZoom, toggleOutline } = layoutSlice.actions
export default layoutSlice.reducer
