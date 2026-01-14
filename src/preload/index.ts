import { contextBridge, ipcRenderer } from 'electron'
import { ElectronAPI, SettingsSchema } from './electron'

const electronAPI: ElectronAPI = {
  file: {
    open: () => ipcRenderer.invoke('file:open'),
    save: (path: string, content: string) => ipcRenderer.invoke('file:save', path, content),
    saveAs: (content: string, suggestedName?: string) => ipcRenderer.invoke('file:saveAs', content, suggestedName),
    copyImage: (sourcePath: string, tabId: string, markdownFilePath: string | null) =>
      ipcRenderer.invoke('file:copyImage', sourcePath, tabId, markdownFilePath),
    autoSave: (tabId: string, content: string, filePath: string | null) =>
      ipcRenderer.invoke('file:autoSave', tabId, content, filePath),
    getTempDir: (tabId: string) => ipcRenderer.invoke('file:getTempDir', tabId),
    moveTempFiles: (tabId: string, savedPath: string) =>
      ipcRenderer.invoke('file:moveTempFiles', tabId, savedPath),
    cleanupTemp: (tabId: string) => ipcRenderer.invoke('file:cleanupTemp', tabId),
    readImageAsDataURL: (imagePath: string) => ipcRenderer.invoke('file:readImageAsDataURL', imagePath)
  },
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
    zoom: (delta: number) => ipcRenderer.send('window:zoom', delta),
    resetZoom: () => ipcRenderer.send('window:resetZoom'),
    getZoom: () => ipcRenderer.invoke('window:getZoom'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
    print: () => ipcRenderer.send('window:print'),
    exportPdf: () => ipcRenderer.invoke('window:exportPdf'),
    toggleDevTools: () => ipcRenderer.send('window:toggleDevTools')
  },
  settings: {
    getAll: () => ipcRenderer.invoke('settings:getAll'),
    get: <K extends keyof SettingsSchema>(key: K) => ipcRenderer.invoke('settings:get', key),
    set: <K extends keyof SettingsSchema>(key: K, value: SettingsSchema[K]) =>
      ipcRenderer.invoke('settings:set', key, value),
    setMultiple: (data: Partial<SettingsSchema>) => ipcRenderer.invoke('settings:setMultiple', data),
    reset: () => ipcRenderer.invoke('settings:reset'),
    getPath: () => ipcRenderer.invoke('settings:getPath')
  },
  onMenuCommand: (callback: (command: string) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, command: string) => callback(command)
    ipcRenderer.on('menu:command', subscription)

    // Return unsubscribe function
    return () => {
      ipcRenderer.removeListener('menu:command', subscription)
    }
  }
}

// Expose protected methods that allow the renderer process to use ipcRenderer
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (For environments where context isolation is disabled)
  window.electron = electronAPI
}
