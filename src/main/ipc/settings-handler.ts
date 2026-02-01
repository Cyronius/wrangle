import { ipcMain } from 'electron'
import Store from 'electron-store'

// Settings schema definition
interface SettingsSchema {
  theme: {
    current: string
    customThemes: Record<string, string>
  }
  shortcuts: {
    currentPreset: string
    customPresets: Record<string, Record<string, string>>
  }
  layout: {
    previewSyncLocked: boolean
    splitRatio: number
  }
}

// Default settings values
const defaults: SettingsSchema = {
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
  }
}

// Create store with schema
const store = new Store<SettingsSchema>({
  name: 'settings',
  defaults
})

export function registerSettingsHandlers(): void {
  // Get all settings
  ipcMain.handle('settings:getAll', () => {
    return store.store
  })

  // Get a specific key
  ipcMain.handle('settings:get', (_event, key: string) => {
    return store.get(key)
  })

  // Set a specific key
  ipcMain.handle('settings:set', (_event, key: string, value: unknown) => {
    store.set(key, value)
    return true
  })

  // Set multiple keys at once
  ipcMain.handle('settings:setMultiple', (_event, data: Partial<SettingsSchema>) => {
    for (const [key, value] of Object.entries(data)) {
      store.set(key, value)
    }
    return true
  })

  // Reset all settings to defaults
  ipcMain.handle('settings:reset', () => {
    store.clear()
    return store.store
  })

  // Get the path where settings are stored
  ipcMain.handle('settings:getPath', () => {
    return store.path
  })
}
