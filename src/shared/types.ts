// Shared types between main and renderer processes

export interface FileData {
  path: string
  content: string
}

export interface SaveResult {
  success: boolean
  path?: string
}
