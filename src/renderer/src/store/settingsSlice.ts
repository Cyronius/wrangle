import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { SettingsSchema } from '../../../preload/electron'
import { commands } from '../commands/registry'

// Shortcut bindings map: commandId -> shortcut string
export type ShortcutBindings = Record<string, string | null>

// Generate default bindings from command registry
function getDefaultBindings(): ShortcutBindings {
  const bindings: ShortcutBindings = {}
  for (const cmd of commands) {
    bindings[cmd.id] = cmd.defaultBinding
  }
  return bindings
}

// Built-in presets
export const builtInPresets: Record<string, ShortcutBindings> = {
  default: getDefaultBindings(),
  vim: {
    // Vim-style bindings (basic - true vim mode would need monaco-vim)
    ...getDefaultBindings(),
    // Override some bindings with vim-style alternatives
    'file.save': 'Ctrl+S', // :w in vim, but keep Ctrl+S for convenience
    'edit.undo': 'Ctrl+Z',
    'edit.redo': 'Ctrl+Shift+Z', // Vim uses Ctrl+R, but that conflicts
    'markdown.bold': 'Ctrl+B',
    'markdown.italic': 'Ctrl+I',
    // Navigation - vim-style would use hjkl but that conflicts with typing
    'nav.nextTab': 'Ctrl+Tab',
    'nav.prevTab': 'Ctrl+Shift+Tab'
  }
}

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
  }
}

const initialState: SettingsState = {
  loaded: false,
  loading: false,
  error: null,
  theme: {
    current: 'dark',
    customThemes: {}
  },
  shortcuts: {
    currentPreset: 'default',
    customPresets: {}
  },
  layout: {
    previewSyncLocked: false,
    splitRatio: 0.5
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

// Async thunk to save theme settings
export const saveThemeSettings = createAsyncThunk(
  'settings/saveTheme',
  async (theme: SettingsState['theme']) => {
    await window.electron.settings.set('theme', theme)
    return theme
  }
)

// Async thunk to save shortcut settings
export const saveShortcutSettings = createAsyncThunk(
  'settings/saveShortcuts',
  async (shortcuts: SettingsState['shortcuts']) => {
    await window.electron.settings.set('shortcuts', shortcuts)
    return shortcuts
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
      // Reset to dark if we deleted the current theme
      if (state.theme.current === action.payload) {
        state.theme.current = 'dark'
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
        }
        if (action.payload.shortcuts) {
          state.shortcuts = action.payload.shortcuts
        }
        if (action.payload.layout) {
          state.layout = action.payload.layout
        }
      })
      .addCase(loadSettings.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || 'Failed to load settings'
      })
      // Save theme
      .addCase(saveThemeSettings.fulfilled, (state, action) => {
        state.theme = action.payload
      })
      // Save shortcuts
      .addCase(saveShortcutSettings.fulfilled, (state, action) => {
        state.shortcuts = action.payload
      })
      // Save layout
      .addCase(saveLayoutSettings.fulfilled, (state, action) => {
        state.layout = action.payload
      })
  }
})

export const {
  setCurrentTheme,
  addCustomTheme,
  updateCustomTheme,
  deleteCustomTheme,
  setCurrentPreset,
  addCustomPreset,
  updateCustomPreset,
  updateShortcutBinding,
  deleteCustomPreset,
  setPreviewSyncLocked,
  setSettingsSplitRatio
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

// Selector to get all available preset names
export function selectAllPresetNames(state: { settings: SettingsState }): string[] {
  return [
    ...Object.keys(builtInPresets),
    ...Object.keys(state.settings.shortcuts.customPresets)
  ]
}
