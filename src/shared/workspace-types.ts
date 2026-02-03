// Workspace types shared between main and renderer processes

export type WorkspaceId = string
export const DEFAULT_WORKSPACE_ID = '__default__'

// Workspace metadata stored in .wrangle/workspace.json
export interface WorkspaceConfig {
  id: WorkspaceId
  name: string // Human-readable (editable)
  color: string // Hex color code
  createdAt: number
  lastOpenedAt: number
  showHiddenFiles?: boolean
}

// Tab state stored per-workspace for session restoration
export interface TabState {
  id: string
  path?: string
  filename: string
  content?: string // Only for unsaved tabs
  isDirty: boolean
  displayTitle?: string
  cursorPosition?: { lineNumber: number; column: number }
  scrollPosition?: number
}

// Session state for workspace persistence
export interface WorkspaceSession {
  tabs: TabState[]
  activeTabId: string | null
  viewMode: 'split' | 'editor-only' | 'preview-only'
  splitRatio: number
  lastSavedAt: number
}

// Runtime workspace state (used in Redux)
export interface WorkspaceState {
  id: WorkspaceId
  name: string
  color: string
  rootPath: string | null // null for default workspace
  isExpanded: boolean
  showHiddenFiles: boolean
}

// File tree node for directory listing
export interface FileTreeNode {
  name: string
  path: string
  isDirectory: boolean
  children?: FileTreeNode[]
}

// Folder change event from file watcher
export interface FolderChange {
  type: 'add' | 'unlink' | 'addDir' | 'unlinkDir' | 'change'
  path: string
}

// Default workspace colors for new workspaces
export const WORKSPACE_COLORS = [
  '#4daafc', // Blue (default)
  '#f97316', // Orange
  '#22c55e', // Green
  '#a855f7', // Purple
  '#ef4444', // Red
  '#14b8a6', // Teal
  '#06b6d4', // Cyan
  '#ec4899' // Pink
]
