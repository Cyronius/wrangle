import { homedir } from 'os'
import { join } from 'path'
import { mkdir, rm, readdir, stat, cp } from 'fs/promises'
import { existsSync } from 'fs'

const TEMP_ROOT_DIR = join(homedir(), '.wrangle')
const DRAFTS_DIR = join(TEMP_ROOT_DIR, 'drafts')

/**
 * Get the temporary directory path for a specific tab
 */
export function getTempDir(tabId: string): string {
  return join(DRAFTS_DIR, tabId)
}

/**
 * Get the assets directory path within a tab's temp directory
 */
export function getTempAssetDir(tabId: string): string {
  return join(getTempDir(tabId), 'assets')
}

/**
 * Ensure the temporary directory exists for a specific tab
 */
export async function ensureTempDir(tabId: string): Promise<void> {
  const tempDir = getTempDir(tabId)

  if (!existsSync(tempDir)) {
    await mkdir(tempDir, { recursive: true })
  }
}

/**
 * Ensure the assets directory exists within a tab's temp directory
 */
export async function ensureTempAssetDir(tabId: string): Promise<void> {
  const assetDir = getTempAssetDir(tabId)

  if (!existsSync(assetDir)) {
    await mkdir(assetDir, { recursive: true })
  }
}

/**
 * Initialize the root temporary directory structure on app start
 */
export async function initTempRoot(): Promise<void> {
  try {
    if (!existsSync(TEMP_ROOT_DIR)) {
      await mkdir(TEMP_ROOT_DIR, { recursive: true })
    }

    if (!existsSync(DRAFTS_DIR)) {
      await mkdir(DRAFTS_DIR, { recursive: true })
    }

    // Optionally clean up old temp directories (older than 7 days)
    await cleanupOldDrafts()
  } catch (error) {
    console.error('Failed to initialize temp root directory:', error)
    throw error
  }
}

/**
 * Clean up old draft directories that haven't been modified in 7 days
 */
async function cleanupOldDrafts(): Promise<void> {
  try {
    if (!existsSync(DRAFTS_DIR)) {
      return
    }

    const entries = await readdir(DRAFTS_DIR)
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000)

    for (const entry of entries) {
      const draftPath = join(DRAFTS_DIR, entry)

      try {
        const stats = await stat(draftPath)

        if (stats.isDirectory() && stats.mtimeMs < sevenDaysAgo) {
          await rm(draftPath, { recursive: true, force: true })
          console.log(`Cleaned up old draft directory: ${entry}`)
        }
      } catch (error) {
        console.warn(`Failed to clean up draft directory ${entry}:`, error)
      }
    }
  } catch (error) {
    console.warn('Failed to clean up old drafts:', error)
  }
}

/**
 * Move temp files (including assets) from temp directory to saved file location
 */
export async function moveTempToSaved(tabId: string, savedPath: string): Promise<void> {
  const tempAssetDir = getTempAssetDir(tabId)

  // Check if temp assets directory exists
  if (!existsSync(tempAssetDir)) {
    return // Nothing to move
  }

  // Get the directory where the file was saved
  const savedDir = join(savedPath, '..')
  const targetAssetDir = join(savedDir, 'assets')

  try {
    // Create target assets directory if it doesn't exist
    if (!existsSync(targetAssetDir)) {
      await mkdir(targetAssetDir, { recursive: true })
    }

    // Copy all files from temp assets to target assets
    const assetFiles = await readdir(tempAssetDir)

    for (const file of assetFiles) {
      const sourcePath = join(tempAssetDir, file)
      const targetPath = join(targetAssetDir, file)

      // Check if it's a file (not a directory)
      const stats = await stat(sourcePath)

      if (stats.isFile()) {
        await cp(sourcePath, targetPath, { force: true })
      }
    }

    // Clean up temp directory after successful move
    await cleanupTempDir(tabId)
  } catch (error) {
    console.error('Failed to move temp files to saved location:', error)
    throw error
  }
}

/**
 * Clean up the temporary directory for a specific tab
 */
export async function cleanupTempDir(tabId: string): Promise<void> {
  const tempDir = getTempDir(tabId)

  if (existsSync(tempDir)) {
    try {
      await rm(tempDir, { recursive: true, force: true })
    } catch (error) {
      console.error(`Failed to cleanup temp directory for tab ${tabId}:`, error)
      throw error
    }
  }
}

/**
 * Get the path to the draft markdown file for a tab
 */
export function getTempDraftPath(tabId: string): string {
  return join(getTempDir(tabId), 'draft.md')
}
