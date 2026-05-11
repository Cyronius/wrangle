import { configureStore } from '@reduxjs/toolkit'
import tabsReducer from './tabsSlice'
import layoutReducer from './layoutSlice'
import settingsReducer from './settingsSlice'
import workspacesReducer from './workspacesSlice'
import { selectCurrentBindings } from './settingsSlice'

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

// KBD-007: publish active preset bindings to main whenever they change so
// the native application menu rebuilds with up-to-date accelerators.
if (typeof window !== 'undefined' && window.electron?.shortcuts?.publishBindings) {
  let lastSerialized = ''
  store.subscribe(() => {
    const bindings = selectCurrentBindings(store.getState())
    const serialized = JSON.stringify(bindings)
    if (serialized === lastSerialized) return
    lastSerialized = serialized
    window.electron.shortcuts.publishBindings(bindings)
  })
}
