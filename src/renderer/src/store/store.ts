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

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
