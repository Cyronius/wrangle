import { FileData, SaveResult } from '../shared/types'

export interface ElectronAPI {
  file: {
    open: () => Promise<FileData | null>
    save: (path: string, content: string) => Promise<boolean>
    saveAs: (content: string, suggestedName?: string) => Promise<string | null>
    copyImage: (
      sourcePath: string,
      tabId: string,
      markdownFilePath: string | null
    ) => Promise<string | null>
    autoSave: (tabId: string, content: string, filePath: string | null) => Promise<string | null>
    getTempDir: (tabId: string) => Promise<string>
    moveTempFiles: (tabId: string, savedPath: string) => Promise<boolean>
    cleanupTemp: (tabId: string) => Promise<boolean>
    readImageAsDataURL: (imagePath: string) => Promise<string | null>
  }
  window: {
    minimize: () => void
    maximize: () => void
    close: () => void
    zoom: (delta: number) => void
    resetZoom: () => void
    getZoom: () => Promise<number>
    isMaximized: () => Promise<boolean>
    print: () => void
    exportPdf: () => Promise<string | null>
    toggleDevTools: () => void
  }
  onMenuCommand: (callback: (command: string) => void) => () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
  }
}
