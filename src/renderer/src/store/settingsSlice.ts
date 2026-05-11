import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { SettingsSchema } from '../../../preload/electron'
import { commands } from '../commands/registry'

// Shortcut bindings map: commandId -> shortcut string
export type ShortcutBindings = Record<string, string | null>

// Generate default bindings from command registry. Computed lazily on first
// access — registry imports action creators from this slice (for view/theme/
// vim-mode commands), so doing this work at module load creates a circular
// dependency in which `commands` is still `undefined` when iterated.
let cachedDefaults: ShortcutBindings | null = null
function getDefaultBindings(): ShortcutBindings {
  if (cachedDefaults) return cachedDefaults
  const bindings: ShortcutBindings = {}
  for (const cmd of commands) {
    bindings[cmd.id] = cmd.defaultBinding
  }
  cachedDefaults = bindings
  return bindings
}

// Built-in presets. Proxy is the lazy-init wrapper; consumers see a normal
// `Record<string, ShortcutBindings>` and access `builtInPresets.default`
// without knowing the value is computed on first read.
export const builtInPresets: Record<string, ShortcutBindings> = new Proxy(
  {} as Record<string, ShortcutBindings>,
  {
    get(target, prop) {
      if (prop === 'default') return getDefaultBindings()
      return (target as Record<string, ShortcutBindings>)[prop as string]
    },
    has(_target, prop) {
      return prop === 'default'
    },
    ownKeys() {
      return ['default']
    },
    getOwnPropertyDescriptor(_target, prop) {
      if (prop === 'default') {
        return { configurable: true, enumerable: true, value: getDefaultBindings() }
      }
      return undefined
    }
  }
)

export interface SettingsState {
  // Loaded status
  loaded: boolean
  loading: boolean
  error: string | null

  // Theme settings
  theme: {
    current: string
    customThemes: Record<string, string>
  }

  // Shortcuts settings
  shortcuts: {
    currentPreset: string
    customPresets: Record<string, ShortcutBindings>
  }

  // Layout settings
  layout: {
    previewSyncLocked: boolean
    splitRatio: number
    sidebarPaneSizes?: number[]
    preferencesDialog?: {
      x: number
      y: number
      width: number
      height: number
    }
  }

  // Editor settings
  editor: {
    vimMode: boolean
  }
}

const initialState: SettingsState = {
  loaded: false,
  loading: false,
  error: null,
  theme: {
    current: 'Dark',
    customThemes: {}
  },
  shortcuts: {
    currentPreset: 'default',
    customPresets: {}
  },
  layout: {
    previewSyncLocked: false,
    splitRatio: 0.5
  },
  editor: {
    vimMode: false
  }
}

// Async thunk to load settings from electron-store
export const loadSettings = createAsyncThunk(
  'settings/load',
  async () => {
    const settings = await window.electron.settings.getAll()
    return settings
  }
)

// Async thunk to save theme settings - reads current state to avoid race conditions
export const saveThemeSettings = createAsyncThunk(
  'settings/saveTheme',
  async (_: void, { getState }) => {
    const state = getState() as { settings: SettingsState }
    const theme = state.settings.theme
    await window.electron.settings.set('theme', theme)
    return theme
  }
)

// Async thunk to save shortcut settings - reads current state to avoid race conditions
export const saveShortcutSettings = createAsyncThunk(
  'settings/saveShortcuts',
  async (_: void, { getState }) => {
    const state = getState() as { settings: SettingsState }
    const shortcuts = state.settings.shortcuts
    await window.electron.settings.set('shortcuts', shortcuts)
    return shortcuts
  }
)

/**
 * Auto-copy on first edit. If the active preset is a built-in, fork it to a
 * unique custom preset (`My Shortcuts`, `My Shortcuts (2)`, ...), switch to
 * it, then apply the binding edit. Otherwise just edits the active preset.
 *
 * KBD-012: silently transitions the user from a read-only built-in to a
 * mutable custom preset on first edit, so users never have to discover a
 * "Copy to Custom" button before customizing a shortcut.
 */
export const editShortcutBinding = createAsyncThunk(
  'settings/editShortcutBinding',
  async (
    { commandId, shortcut }: { commandId: string; shortcut: string | null },
    { getState, dispatch }
  ) => {
    const state = getState() as { settings: SettingsState }
    const { currentPreset, customPresets } = state.settings.shortcuts

    let activePreset = currentPreset
    if (builtInPresets[currentPreset]) {
      const baseName = 'My Shortcuts'
      let candidate = baseName
      let n = 2
      const taken = new Set([
        ...Object.keys(builtInPresets),
        ...Object.keys(customPresets)
      ])
      while (taken.has(candidate)) {
        candidate = `${baseName} (${n++})`
      }

      const sourceBindings = builtInPresets[currentPreset]
      dispatch(addCustomPreset({ name: candidate, bindings: { ...sourceBindings } }))
      dispatch(setCurrentPreset(candidate))
      activePreset = candidate
    }

    dispatch(updateShortcutBinding({ presetName: activePreset, commandId, shortcut }))
    return activePreset
  }
)

// Async thunk to save editor settings
export const saveEditorSettings = createAsyncThunk(
  'settings/saveEditor',
  async (_: void, { getState }) => {
    const state = getState() as { settings: SettingsState }
    const editor = state.settings.editor
    await window.electron.settings.set('editor', editor)
    return editor
  }
)

// Async thunk to save layout settings
export const saveLayoutSettings = createAsyncThunk(
  'settings/saveLayout',
  async (layout: SettingsState['layout']) => {
    await window.electron.settings.set('layout', layout)
    return layout
  }
)

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    // Theme actions
    setCurrentTheme(state, action: PayloadAction<string>) {
      state.theme.current = action.payload
    },
    addCustomTheme(state, action: PayloadAction<{ name: string; css: string }>) {
      state.theme.customThemes[action.payload.name] = action.payload.css
    },
    updateCustomTheme(state, action: PayloadAction<{ name: string; css: string }>) {
      if (state.theme.customThemes[action.payload.name] !== undefined) {
        state.theme.customThemes[action.payload.name] = action.payload.css
      }
    },
    deleteCustomTheme(state, action: PayloadAction<string>) {
      delete state.theme.customThemes[action.payload]
      // Reset to Dark if we deleted the current theme
      if (state.theme.current === action.payload) {
        state.theme.current = 'Dark'
      }
    },
    renameCustomTheme(state, action: PayloadAction<{ oldName: string; newName: string }>) {
      const css = state.theme.customThemes[action.payload.oldName]
      if (css === undefined) return
      const updatedCSS = css.replace(
        /:root\[data-theme=['"][^'"]+['"]\]/g,
        `:root[data-theme='${action.payload.newName}']`
      )
      delete state.theme.customThemes[action.payload.oldName]
      state.theme.customThemes[action.payload.newName] = updatedCSS
      if (state.theme.current === action.payload.oldName) {
        state.theme.current = action.payload.newName
      }
    },

    // Shortcut actions
    setCurrentPreset(state, action: PayloadAction<string>) {
      state.shortcuts.currentPreset = action.payload
    },
    addCustomPreset(state, action: PayloadAction<{ name: string; bindings: ShortcutBindings }>) {
      state.shortcuts.customPresets[action.payload.name] = action.payload.bindings
    },
    updateCustomPreset(state, action: PayloadAction<{ name: string; bindings: ShortcutBindings }>) {
      if (state.shortcuts.customPresets[action.payload.name] !== undefined) {
        state.shortcuts.customPresets[action.payload.name] = action.payload.bindings
      }
    },
    updateShortcutBinding(
      state,
      action: PayloadAction<{ presetName: string; commandId: string; shortcut: string | null }>
    ) {
      const { presetName, commandId, shortcut } = action.payload
      if (state.shortcuts.customPresets[presetName]) {
        state.shortcuts.customPresets[presetName][commandId] = shortcut
      }
    },
    deleteCustomPreset(state, action: PayloadAction<string>) {
      delete state.shortcuts.customPresets[action.payload]
      // Reset to default if we deleted the current preset
      if (state.shortcuts.currentPreset === action.payload) {
        state.shortcuts.currentPreset = 'default'
      }
    },

    // Layout actions
    setPreviewSyncLocked(state, action: PayloadAction<boolean>) {
      state.layout.previewSyncLocked = action.payload
    },
    setSettingsSplitRatio(state, action: PayloadAction<number>) {
      state.layout.splitRatio = action.payload
    },
    setPreferencesDialogBounds(state, action: PayloadAction<{ x: number; y: number; width: number; height: number }>) {
      state.layout.preferencesDialog = action.payload
    },
    setSidebarPaneSizes(state, action: PayloadAction<number[]>) {
      state.layout.sidebarPaneSizes = action.payload
    },

    // Editor actions
    setVimMode(state, action: PayloadAction<boolean>) {
      state.editor.vimMode = action.payload
    }
  },
  extraReducers: (builder) => {
    builder
      // Load settings
      .addCase(loadSettings.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(loadSettings.fulfilled, (state, action) => {
        state.loading = false
        state.loaded = true
        // Merge loaded settings with state
        if (action.payload.theme) {
          state.theme = action.payload.theme
          // Migrate old lowercase 'dark' theme name
          if (state.theme.current === 'dark') {
            state.theme.current = 'Dark'
          }
        }
        if (action.payload.shortcuts) {
          state.shortcuts = action.payload.shortcuts
        }
        if (action.payload.layout) {
          state.layout = action.payload.layout
        }
        if (action.payload.editor) {
          state.editor = action.payload.editor
        }
      })
      .addCase(loadSettings.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || 'Failed to load settings'
      })
      // Save theme - don't overwrite state, it's already updated by sync reducers
      .addCase(saveThemeSettings.fulfilled, () => {
        // Persistence handled by the thunk. State is source of truth.
      })
      // Save shortcuts - don't overwrite state, it's already updated by sync reducers
      .addCase(saveShortcutSettings.fulfilled, () => {
        // Persistence handled by the thunk. State is source of truth.
      })
      // Save layout
      .addCase(saveLayoutSettings.fulfilled, (state, action) => {
        state.layout = action.payload
      })
      // Save editor
      .addCase(saveEditorSettings.fulfilled, (state, action) => {
        state.editor = action.payload
      })
  }
})

export const {
  setCurrentTheme,
  addCustomTheme,
  updateCustomTheme,
  deleteCustomTheme,
  renameCustomTheme,
  setCurrentPreset,
  addCustomPreset,
  updateCustomPreset,
  updateShortcutBinding,
  deleteCustomPreset,
  setPreviewSyncLocked,
  setSettingsSplitRatio,
  setPreferencesDialogBounds,
  setSidebarPaneSizes,
  setVimMode
} = settingsSlice.actions

export default settingsSlice.reducer

// Selector to get current active bindings
export function selectCurrentBindings(state: { settings: SettingsState }): ShortcutBindings {
  const { currentPreset, customPresets } = state.settings.shortcuts

  // Check built-in presets first
  if (builtInPresets[currentPreset]) {
    return builtInPresets[currentPreset]
  }

  // Then check custom presets
  if (customPresets[currentPreset]) {
    return customPresets[currentPreset]
  }

  // Fallback to default
  return builtInPresets.default
}

// Selector to check if current preset is built-in (read-only)
export function selectIsBuiltInPreset(state: { settings: SettingsState }): boolean {
  return !!builtInPresets[state.settings.shortcuts.currentPreset]
}

// Selector to get vim mode state
export function selectVimMode(state: { settings: SettingsState }): boolean {
  return state.settings.editor?.vimMode ?? false
}

// Selector to get all available preset names
export function selectAllPresetNames(state: { settings: SettingsState }): string[] {
  return [
    ...Object.keys(builtInPresets),
    ...Object.keys(state.settings.shortcuts.customPresets)
  ]
}

/**
 * Returns the modifier-key portion of the binding for a `bindingShape.suffix`
 * command (e.g. `view.zoomScroll`), or null if unbound. KBD-014: the wheel /
 * tap / drag dispatchers read this instead of hardcoding `e.ctrlKey`.
 */
export function selectModifierBinding(
  state: { settings: SettingsState },
  commandId: string
): 'Ctrl' | 'Shift' | 'Alt' | 'Meta' | null {
  const bindings = selectCurrentBindings(state)
  const raw = bindings[commandId]
  if (!raw) return null
  const upper = raw.trim().toUpperCase()
  if (upper === 'CTRL' || upper === 'CONTROL') return 'Ctrl'
  if (upper === 'SHIFT') return 'Shift'
  if (upper === 'ALT') return 'Alt'
  if (upper === 'META' || upper === 'CMD' || upper === 'WIN') return 'Meta'
  return null
}

/**
 * Test whether a keyboard or wheel event matches the given modifier name.
 * KBD-014.
 */
export function eventMatchesModifier(
  event: { ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean; metaKey?: boolean },
  modifier: 'Ctrl' | 'Shift' | 'Alt' | 'Meta' | null
): boolean {
  if (!modifier) return false
  switch (modifier) {
    case 'Ctrl': return !!event.ctrlKey
    case 'Shift': return !!event.shiftKey
    case 'Alt': return !!event.altKey
    case 'Meta': return !!event.metaKey
  }
}
