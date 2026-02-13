import { configureStore } from '@reduxjs/toolkit'
import tabsReducer from './tabsSlice'
import layoutReducer from './layoutSlice'
import settingsReducer from './settingsSlice'
import workspacesReducer from './workspacesSlice'

export const store = configureStore({
  reducer: {
    tabs: tabsReducer,
    layout: layoutReducer,
    settings: settingsReducer,
    workspaces: workspacesReducer
  }
})

// Expose store for E2E testing
if (typeof window !== 'undefined') {
  ;(window as unknown as { __REDUX_STORE__: typeof store }).__REDUX_STORE__ = store
}

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
