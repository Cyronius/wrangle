import { ipcMain, dialog } from 'electron'
import {
  loadWorkspaceConfig,
  saveWorkspaceConfig,
  loadWorkspaceSession,
  saveWorkspaceSession,
  listFiles,
  listFilesRecursive,
  createDefaultConfig,
  isInsideWorkspace,
  hasWorkspaceDir,
  ensureWorkspaceDir,
  loadAppSession,
  saveAppSession,
  loadDefaultSession,
  saveDefaultSession,
  AppSession
} from '../utils/workspace-manager'
import { WorkspaceConfig, WorkspaceSession } from '../../shared/workspace-types'

// File watching will be implemented in Phase 2 with the file tree UI
// For now, the renderer can manually refresh when needed

export function registerWorkspaceHandlers(): void {
  // Open folder dialog and return workspace info
  ipcMain.handle('workspace:openFolder', async (_event, usedColors: string[] = []) => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Open Folder as Workspace'
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    const folderPath = result.filePaths[0]

    try {
      // Check if workspace config already exists
      let config = await loadWorkspaceConfig(folderPath)

      if (!config) {
        // Create new workspace config
        config = createDefaultConfig(folderPath, usedColors)
        await saveWorkspaceConfig(folderPath, config)
      } else {
        // Update lastOpenedAt
        config.lastOpenedAt = Date.now()
        await saveWorkspaceConfig(folderPath, config)
      }

      return {
        path: folderPath,
        config
      }
    } catch (error) {
      console.error('Error opening workspace folder:', error)
      dialog.showErrorBox('Workspace Error', `Could not open workspace: ${error}`)
      return null
    }
  })

  // Load workspace config from path
  ipcMain.handle('workspace:loadConfig', async (_event, folderPath: string) => {
    try {
      return await loadWorkspaceConfig(folderPath)
    } catch (error) {
      console.error(`Error loading workspace config for ${folderPath}:`, error)
      return null
    }
  })

  // Save workspace config
  ipcMain.handle(
    'workspace:saveConfig',
    async (_event, folderPath: string, config: WorkspaceConfig) => {
      try {
        return await saveWorkspaceConfig(folderPath, config)
      } catch (error) {
        console.error(`Error saving workspace config for ${folderPath}:`, error)
        return false
      }
    }
  )

  // Load workspace session
  ipcMain.handle('workspace:loadSession', async (_event, folderPath: string) => {
    try {
      return await loadWorkspaceSession(folderPath)
    } catch (error) {
      console.error(`Error loading workspace session for ${folderPath}:`, error)
      return null
    }
  })

  // Save workspace session
  ipcMain.handle(
    'workspace:saveSession',
    async (_event, folderPath: string, session: WorkspaceSession) => {
      try {
        return await saveWorkspaceSession(folderPath, session)
      } catch (error) {
        console.error(`Error saving workspace session for ${folderPath}:`, error)
        return false
      }
    }
  )

  // List files in directory (non-recursive for lazy loading)
  ipcMain.handle('workspace:listFiles', async (_event, folderPath: string) => {
    try {
      return await listFiles(folderPath)
    } catch (error) {
      console.error(`Error listing files in ${folderPath}:`, error)
      return []
    }
  })

  // List files recursively (for initial tree load)
  ipcMain.handle(
    'workspace:listFilesRecursive',
    async (_event, folderPath: string, maxDepth: number = 5) => {
      try {
        return await listFilesRecursive(folderPath, maxDepth)
      } catch (error) {
        console.error(`Error listing files recursively in ${folderPath}:`, error)
        return []
      }
    }
  )

  // Stub for folder watching - will be implemented in Phase 2
  ipcMain.handle('workspace:watchFolder', async (_event, _folderPath: string) => {
    // File watching will be added in Phase 2 with the file tree UI
    return true
  })

  // Stub for stopping folder watch
  ipcMain.handle('workspace:unwatchFolder', async (_event, _folderPath: string) => {
    return true
  })

  // Create .wrangle directory for a folder
  ipcMain.handle('workspace:createWorkspaceDir', async (_event, folderPath: string) => {
    try {
      await ensureWorkspaceDir(folderPath)
      return true
    } catch (error) {
      console.error(`Error creating workspace dir for ${folderPath}:`, error)
      return false
    }
  })

  // Check if a file path is inside a workspace
  ipcMain.handle(
    'workspace:isPathInWorkspace',
    async (_event, filePath: string, workspacePath: string) => {
      return isInsideWorkspace(filePath, workspacePath)
    }
  )

  // Check if a folder has .wrangle directory
  ipcMain.handle('workspace:hasWorkspaceDir', async (_event, folderPath: string) => {
    return hasWorkspaceDir(folderPath)
  })

  // Load app-level session
  ipcMain.handle('workspace:loadAppSession', async () => {
    try {
      return await loadAppSession()
    } catch (error) {
      console.error('Error loading app session:', error)
      return null
    }
  })

  // Save app-level session
  ipcMain.handle('workspace:saveAppSession', async (_event, session: AppSession) => {
    try {
      return await saveAppSession(session)
    } catch (error) {
      console.error('Error saving app session:', error)
      return false
    }
  })

  // Load default workspace session
  ipcMain.handle('workspace:loadDefaultSession', async () => {
    try {
      return await loadDefaultSession()
    } catch (error) {
      console.error('Error loading default session:', error)
      return null
    }
  })

  // Save default workspace session
  ipcMain.handle('workspace:saveDefaultSession', async (_event, session: WorkspaceSession) => {
    try {
      return await saveDefaultSession(session)
    } catch (error) {
      console.error('Error saving default session:', error)
      return false
    }
  })
}
