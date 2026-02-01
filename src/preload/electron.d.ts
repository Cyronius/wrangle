import { FileData, SaveResult } from '../shared/types'
import {
  WorkspaceConfig,
  WorkspaceSession,
  FileTreeNode,
  FolderChange
} from '../shared/workspace-types'

// Re-export for convenience
export type { WorkspaceConfig, WorkspaceSession, FileTreeNode, FolderChange }

// App-level session for restoring workspaces across app restarts
export interface AppSession {
  openWorkspaces: string[] // Array of workspace root paths
  activeWorkspacePath: string | null
  lastSavedAt: number
  // Multi-pane mode state
  multiPaneEnabled?: boolean
  visiblePaneWorkspacePaths?: string[] // Workspace paths for visible panes
  focusedPaneWorkspacePath?: string | null
}

export interface OrphanedDraft {
  tabId: string
  content: string
  lastModified: number
}

export interface CrashRecoveryInfo {
  didCrash: boolean
  orphanedDrafts: OrphanedDraft[]
}

export interface SettingsSchema {
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

export interface ElectronAPI {
  file: {
    open: () => Promise<FileData | null>
    readByPath: (filePath: string) => Promise<FileData | null>
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
  settings: {
    getAll: () => Promise<SettingsSchema>
    get: <K extends keyof SettingsSchema>(key: K) => Promise<SettingsSchema[K]>
    set: <K extends keyof SettingsSchema>(key: K, value: SettingsSchema[K]) => Promise<boolean>
    setMultiple: (data: Partial<SettingsSchema>) => Promise<boolean>
    reset: () => Promise<SettingsSchema>
    getPath: () => Promise<string>
  }
  workspace: {
    // Open folder dialog and return workspace info
    openFolder: (usedColors?: string[]) => Promise<{ path: string; config: WorkspaceConfig } | null>
    // Load workspace config from path
    loadConfig: (folderPath: string) => Promise<WorkspaceConfig | null>
    // Save workspace config
    saveConfig: (folderPath: string, config: WorkspaceConfig) => Promise<boolean>
    // Load workspace session (tabs, scroll positions, etc.)
    loadSession: (folderPath: string) => Promise<WorkspaceSession | null>
    // Save workspace session
    saveSession: (folderPath: string, session: WorkspaceSession) => Promise<boolean>
    // List files in directory (non-recursive)
    listFiles: (folderPath: string) => Promise<FileTreeNode[]>
    // List files recursively
    listFilesRecursive: (folderPath: string, maxDepth?: number) => Promise<FileTreeNode[]>
    // Start watching a folder for changes
    watchFolder: (folderPath: string) => Promise<boolean>
    // Stop watching a folder
    unwatchFolder: (folderPath: string) => Promise<boolean>
    // Create .wrangle directory
    createWorkspaceDir: (folderPath: string) => Promise<boolean>
    // Check if file is inside workspace
    isPathInWorkspace: (filePath: string, workspacePath: string) => Promise<boolean>
    // Check if folder has .wrangle directory
    hasWorkspaceDir: (folderPath: string) => Promise<boolean>
    // Load app-level session
    loadAppSession: () => Promise<AppSession | null>
    // Save app-level session
    saveAppSession: (session: AppSession) => Promise<boolean>
    // Load default workspace session (for non-folder tabs)
    loadDefaultSession: () => Promise<WorkspaceSession | null>
    // Save default workspace session
    saveDefaultSession: (session: WorkspaceSession) => Promise<boolean>
    // Listen for folder changes
    onFolderChanged: (
      callback: (folderPath: string, changes: FolderChange[]) => void
    ) => () => void
  }
  crashRecovery: {
    check: () => Promise<CrashRecoveryInfo>
  }
  onMenuCommand: (callback: (command: string) => void) => () => void
  onFileOpenedFromPath: (callback: (fileData: { path: string; content: string }) => void) => () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
  }
}
