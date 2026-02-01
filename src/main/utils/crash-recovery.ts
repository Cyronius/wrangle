import { homedir } from 'os'
import { join } from 'path'
import { writeFile, unlink, readdir, readFile, stat } from 'fs/promises'
import { existsSync } from 'fs'

const WRANGLE_DIR = join(homedir(), '.wrangle')
const RUNNING_MARKER = join(WRANGLE_DIR, '.running')
const DRAFTS_DIR = join(WRANGLE_DIR, 'drafts')

export interface OrphanedDraft {
  tabId: string
  content: string
  lastModified: number
}

/**
 * Check if the app crashed last time (marker file exists).
 */
export function didCrashLastSession(): boolean {
  return existsSync(RUNNING_MARKER)
}

/**
 * Create the running marker on startup.
 */
export async function createRunningMarker(): Promise<void> {
  await writeFile(RUNNING_MARKER, String(Date.now()), 'utf-8')
}

/**
 * Remove the running marker on clean shutdown.
 */
export async function clearRunningMarker(): Promise<void> {
  if (existsSync(RUNNING_MARKER)) {
    await unlink(RUNNING_MARKER)
  }
}

/**
 * Scan the drafts directory for orphaned draft files.
 * Returns draft info for any tab directories that contain a draft.md file.
 */
export async function findOrphanedDrafts(): Promise<OrphanedDraft[]> {
  if (!existsSync(DRAFTS_DIR)) return []

  const entries = await readdir(DRAFTS_DIR)
  const orphans: OrphanedDraft[] = []

  for (const entry of entries) {
    const draftPath = join(DRAFTS_DIR, entry, 'draft.md')
    if (existsSync(draftPath)) {
      try {
        const content = await readFile(draftPath, 'utf-8')
        if (!content.trim()) continue // Skip empty drafts
        const stats = await stat(draftPath)
        orphans.push({
          tabId: entry,
          content,
          lastModified: stats.mtimeMs
        })
      } catch {
        // Skip unreadable drafts
      }
    }
  }

  return orphans
}
