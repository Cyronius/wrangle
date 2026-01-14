import { configureStore } from '@reduxjs/toolkit'
import tabsReducer from './tabsSlice'
import layoutReducer from './layoutSlice'
import themeReducer from './themeSlice'
import settingsReducer from './settingsSlice'

export const store = configureStore({
  reducer: {
    tabs: tabsReducer,
    layout: layoutReducer,
    theme: themeReducer,
    settings: settingsReducer
  }
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
