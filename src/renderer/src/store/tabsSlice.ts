import { createSlice, PayloadAction, createSelector } from '@reduxjs/toolkit'

export interface TabDocument {
  id: string
  path?: string
  filename: string
  content: string
  isDirty: boolean
  displayTitle?: string  // H1 heading for unsaved files
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

// Memoized selectors - these prevent unnecessary re-renders
// Base selectors (input selectors)
const selectTabsSlice = (state: { tabs: TabsState }) => state.tabs
export const selectTabsArray = (state: { tabs: TabsState }) => state.tabs.tabs
const selectActiveTabIdRaw = (state: { tabs: TabsState }) => state.tabs.activeTabId

// Memoized selector for active tab ID
export const selectActiveTabId = createSelector(
  [selectActiveTabIdRaw],
  (activeTabId) => activeTabId
)

// Memoized selector for active tab - only recomputes when tabs array or activeTabId changes
export const selectActiveTab = createSelector(
  [selectTabsArray, selectActiveTabIdRaw],
  (tabs, activeTabId) => tabs.find(t => t.id === activeTabId)
)

// Memoized selector for tab IDs - useful for rendering tab list without re-rendering on content changes
export const selectTabIds = createSelector(
  [selectTabsArray],
  (tabs) => tabs.map(t => t.id)
)

// Memoized selector for tabs count
export const selectTabsCount = createSelector(
  [selectTabsArray],
  (tabs) => tabs.length
)

// Selector factory for individual tab by ID
export const makeSelectTabById = (tabId: string) => createSelector(
  [selectTabsArray],
  (tabs) => tabs.find(t => t.id === tabId)
)
