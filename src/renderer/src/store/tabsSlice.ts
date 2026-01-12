import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export interface TabDocument {
  id: string
  path?: string
  filename: string
  content: string
  isDirty: boolean
}

interface TabsState {
  tabs: TabDocument[]
  activeTabId: string | null
}

const initialState: TabsState = {
  tabs: [],
  activeTabId: null
}

const tabsSlice = createSlice({
  name: 'tabs',
  initialState,
  reducers: {
    addTab(state, action: PayloadAction<TabDocument>) {
      state.tabs.push(action.payload)
      state.activeTabId = action.payload.id
    },
    closeTab(state, action: PayloadAction<string>) {
      const index = state.tabs.findIndex((tab) => tab.id === action.payload)
      if (index !== -1) {
        state.tabs.splice(index, 1)

        if (state.activeTabId === action.payload) {
          state.activeTabId = state.tabs.length > 0 ? state.tabs[0].id : null
        }
      }
    },
    setActiveTab(state, action: PayloadAction<string>) {
      state.activeTabId = action.payload
    },
    updateTab(state, action: PayloadAction<Partial<TabDocument> & { id: string }>) {
      const tab = state.tabs.find((t) => t.id === action.payload.id)
      if (tab) {
        Object.assign(tab, action.payload)
      }
    },
    nextTab(state) {
      if (state.tabs.length <= 1) return
      const currentIndex = state.tabs.findIndex((t) => t.id === state.activeTabId)
      const nextIndex = (currentIndex + 1) % state.tabs.length
      state.activeTabId = state.tabs[nextIndex].id
    },
    previousTab(state) {
      if (state.tabs.length <= 1) return
      const currentIndex = state.tabs.findIndex((t) => t.id === state.activeTabId)
      const prevIndex = currentIndex === 0 ? state.tabs.length - 1 : currentIndex - 1
      state.activeTabId = state.tabs[prevIndex].id
    }
  }
})

export const { addTab, closeTab, setActiveTab, updateTab, nextTab, previousTab } = tabsSlice.actions
export default tabsSlice.reducer
