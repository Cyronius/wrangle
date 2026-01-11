import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export type ViewMode = 'split' | 'editor-only' | 'preview-only'

interface LayoutState {
  viewMode: ViewMode
  splitRatio: number
  previewSync: boolean
}

const initialState: LayoutState = {
  viewMode: 'split',
  splitRatio: 0.5,
  previewSync: true
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
    }
  }
})

export const { setViewMode, setSplitRatio, togglePreviewSync } = layoutSlice.actions
export default layoutSlice.reducer
