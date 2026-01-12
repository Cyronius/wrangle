import { contextBridge, ipcRenderer } from 'electron'
import { ElectronAPI } from './electron'

const electronAPI: ElectronAPI = {
  file: {
    open: () => ipcRenderer.invoke('file:open'),
    save: (path: string, content: string) => ipcRenderer.invoke('file:save', path, content),
    saveAs: (content: string) => ipcRenderer.invoke('file:saveAs', content),
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
    toggleDevTools: () => ipcRenderer.send('window:toggleDevTools')
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
