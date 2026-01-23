import { homedir } from 'os'
import { join, basename, relative, normalize, sep } from 'path'
import { mkdir, readFile, writeFile, readdir, stat } from 'fs/promises'
import { existsSync } from 'fs'
import {
  WorkspaceConfig,
  WorkspaceSession,
  FileTreeNode,
  WORKSPACE_COLORS
} from '../../shared/workspace-types'

const WRANGLE_DIR = '.wrangle'
const WORKSPACE_CONFIG_FILE = 'workspace.json'
const SESSION_FILE = 'session.json'

// App-level session storage
const APP_DATA_DIR = join(homedir(), '.wrangle')
const APP_SESSION_FILE = join(APP_DATA_DIR, 'app-session.json')
const DEFAULT_SESSION_FILE = join(APP_DATA_DIR, 'default-session.json')

/**
 * Generate a unique workspace ID
 */
export function generateWorkspaceId(): string {
  return `ws-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Get the .wrangle directory path for a workspace folder
 */
export function getWorkspaceDir(folderPath: string): string {
  return join(folderPath, WRANGLE_DIR)
}

/**
 * Get the workspace.json config file path
 */
export function getWorkspaceConfigPath(folderPath: string): string {
  return join(getWorkspaceDir(folderPath), WORKSPACE_CONFIG_FILE)
}

/**
 * Get the session.json file path for a workspace
 */
export function getWorkspaceSessionPath(folderPath: string): string {
  return join(getWorkspaceDir(folderPath), SESSION_FILE)
}

/**
 * Check if a folder has a .wrangle directory (is a known workspace)
 */
export function hasWorkspaceDir(folderPath: string): boolean {
  return existsSync(getWorkspaceDir(folderPath))
}

/**
 * Ensure the .wrangle directory exists for a workspace
 */
export async function ensureWorkspaceDir(folderPath: string): Promise<void> {
  const workspaceDir = getWorkspaceDir(folderPath)
  if (!existsSync(workspaceDir)) {
    await mkdir(workspaceDir, { recursive: true })
  }
}

/**
 * Get the next available workspace color (cycles through predefined colors)
 */
export function getNextWorkspaceColor(usedColors: string[]): string {
  for (const color of WORKSPACE_COLORS) {
    if (!usedColors.includes(color)) {
      return color
    }
  }
  // If all colors are used, start over
  return WORKSPACE_COLORS[usedColors.length % WORKSPACE_COLORS.length]
}

/**
 * Create a default workspace config for a folder
 */
export function createDefaultConfig(folderPath: string, usedColors: string[] = []): WorkspaceConfig {
  return {
    id: generateWorkspaceId(),
    name: basename(folderPath),
    color: getNextWorkspaceColor(usedColors),
    createdAt: Date.now(),
    lastOpenedAt: Date.now()
  }
}

/**
 * Load workspace config from .wrangle/workspace.json
 */
export async function loadWorkspaceConfig(folderPath: string): Promise<WorkspaceConfig | null> {
  const configPath = getWorkspaceConfigPath(folderPath)

  if (!existsSync(configPath)) {
    return null
  }

  try {
    const content = await readFile(configPath, 'utf-8')
    return JSON.parse(content) as WorkspaceConfig
  } catch (error) {
    console.error(`Failed to load workspace config from ${configPath}:`, error)
    return null
  }
}

/**
 * Save workspace config to .wrangle/workspace.json
 */
export async function saveWorkspaceConfig(
  folderPath: string,
  config: WorkspaceConfig
): Promise<boolean> {
  try {
    await ensureWorkspaceDir(folderPath)
    const configPath = getWorkspaceConfigPath(folderPath)
    await writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8')
    return true
  } catch (error) {
    console.error(`Failed to save workspace config to ${folderPath}:`, error)
    return false
  }
}

/**
 * Load workspace session from .wrangle/session.json
 */
export async function loadWorkspaceSession(folderPath: string): Promise<WorkspaceSession | null> {
  const sessionPath = getWorkspaceSessionPath(folderPath)

  if (!existsSync(sessionPath)) {
    return null
  }

  try {
    const content = await readFile(sessionPath, 'utf-8')
    return JSON.parse(content) as WorkspaceSession
  } catch (error) {
    console.error(`Failed to load workspace session from ${sessionPath}:`, error)
    return null
  }
}

/**
 * Save workspace session to .wrangle/session.json
 */
export async function saveWorkspaceSession(
  folderPath: string,
  session: WorkspaceSession
): Promise<boolean> {
  try {
    await ensureWorkspaceDir(folderPath)
    const sessionPath = getWorkspaceSessionPath(folderPath)
    await writeFile(sessionPath, JSON.stringify(session, null, 2), 'utf-8')
    return true
  } catch (error) {
    console.error(`Failed to save workspace session to ${folderPath}:`, error)
    return false
  }
}

/**
 * Check if a file path is inside a workspace folder
 */
export function isInsideWorkspace(filePath: string, workspacePath: string): boolean {
  const normalizedFile = normalize(filePath)
  const normalizedWorkspace = normalize(workspacePath)

  // Get relative path - if it starts with "..", file is outside workspace
  const relativePath = relative(normalizedWorkspace, normalizedFile)
  return !relativePath.startsWith('..') && !relativePath.startsWith(sep + '..')
}

/**
 * List files in a directory recursively (for file tree)
 */
export async function listFilesRecursive(
  dirPath: string,
  maxDepth: number = 10,
  currentDepth: number = 0
): Promise<FileTreeNode[]> {
  if (currentDepth >= maxDepth) {
    return []
  }

  const entries = await readdir(dirPath)
  const nodes: FileTreeNode[] = []

  for (const entry of entries) {
    // Skip hidden files and directories (including .wrangle)
    if (entry.startsWith('.')) {
      continue
    }

    const fullPath = join(dirPath, entry)

    try {
      const stats = await stat(fullPath)
      const isDirectory = stats.isDirectory()

      const node: FileTreeNode = {
        name: entry,
        path: fullPath,
        isDirectory
      }

      if (isDirectory) {
        node.children = await listFilesRecursive(fullPath, maxDepth, currentDepth + 1)
      }

      nodes.push(node)
    } catch (error) {
      // Skip files we can't access
      console.warn(`Skipping inaccessible file: ${fullPath}`)
    }
  }

  // Sort: directories first, then alphabetically
  nodes.sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1
    if (!a.isDirectory && b.isDirectory) return 1
    return a.name.localeCompare(b.name)
  })

  return nodes
}

/**
 * List files in a directory (non-recursive, for lazy loading)
 */
export async function listFiles(dirPath: string): Promise<FileTreeNode[]> {
  const entries = await readdir(dirPath)
  const nodes: FileTreeNode[] = []

  for (const entry of entries) {
    // Skip hidden files and directories (including .wrangle)
    if (entry.startsWith('.')) {
      continue
    }

    const fullPath = join(dirPath, entry)

    try {
      const stats = await stat(fullPath)

      nodes.push({
        name: entry,
        path: fullPath,
        isDirectory: stats.isDirectory()
      })
    } catch (error) {
      // Skip files we can't access
      console.warn(`Skipping inaccessible file: ${fullPath}`)
    }
  }

  // Sort: directories first, then alphabetically
  nodes.sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1
    if (!a.isDirectory && b.isDirectory) return 1
    return a.name.localeCompare(b.name)
  })

  return nodes
}

// App-level session management

export interface AppSession {
  openWorkspaces: string[] // Array of workspace root paths
  activeWorkspacePath: string | null
  lastSavedAt: number
}

/**
 * Load app-level session (which workspaces were open)
 */
export async function loadAppSession(): Promise<AppSession | null> {
  if (!existsSync(APP_SESSION_FILE)) {
    return null
  }

  try {
    const content = await readFile(APP_SESSION_FILE, 'utf-8')
    return JSON.parse(content) as AppSession
  } catch (error) {
    console.error('Failed to load app session:', error)
    return null
  }
}

/**
 * Save app-level session
 */
export async function saveAppSession(session: AppSession): Promise<boolean> {
  try {
    if (!existsSync(APP_DATA_DIR)) {
      await mkdir(APP_DATA_DIR, { recursive: true })
    }
    await writeFile(APP_SESSION_FILE, JSON.stringify(session, null, 2), 'utf-8')
    return true
  } catch (error) {
    console.error('Failed to save app session:', error)
    return false
  }
}

/**
 * Load the default workspace session (for tabs not associated with a folder workspace)
 */
export async function loadDefaultSession(): Promise<WorkspaceSession | null> {
  if (!existsSync(DEFAULT_SESSION_FILE)) {
    return null
  }

  try {
    const content = await readFile(DEFAULT_SESSION_FILE, 'utf-8')
    return JSON.parse(content) as WorkspaceSession
  } catch (error) {
    console.error('Failed to load default session:', error)
    return null
  }
}

/**
 * Save the default workspace session
 */
export async function saveDefaultSession(session: WorkspaceSession): Promise<boolean> {
  try {
    if (!existsSync(APP_DATA_DIR)) {
      await mkdir(APP_DATA_DIR, { recursive: true })
    }
    await writeFile(DEFAULT_SESSION_FILE, JSON.stringify(session, null, 2), 'utf-8')
    return true
  } catch (error) {
    console.error('Failed to save default session:', error)
    return false
  }
}
