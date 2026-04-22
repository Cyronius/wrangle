import { homedir } from 'os'
import { join } from 'path'
import { writeFile, unlink, readdir, readFile, stat, mkdir } from 'fs/promises'
import { existsSync, readFileSync } from 'fs'

const WRANGLE_DIR = join(homedir(), '.wrangle')
const RUNNING_MARKER = join(WRANGLE_DIR, '.running')
const DRAFTS_DIR = join(WRANGLE_DIR, 'drafts')

export interface OrphanedDraft {
  tabId: string
  content: string
  lastModified: number
}

/**
 * Return the PID recorded in the running marker, or null if the marker
 * is missing, unreadable, or doesn't contain a valid PID.
 */
export function readRunningMarkerPid(): number | null {
  if (!existsSync(RUNNING_MARKER)) return null
  try {
    const raw = readFileSync(RUNNING_MARKER, 'utf-8').trim()
    const pid = parseInt(raw, 10)
    return Number.isFinite(pid) && pid > 0 ? pid : null
  } catch {
    return null
  }
}

/**
 * Returns true if a process with the given PID is currently running.
 * Uses signal 0 (probe only) which throws ESRCH when the process is gone
 * and EPERM when it exists but we lack permission to signal it.
 */
function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === 'EPERM'
  }
}

/**
 * Check if the app crashed last time. A crash is inferred when the marker
 * file exists but the PID it references is no longer alive (or the marker
 * is corrupt / PID is absent). If the PID is alive, the previous run is
 * still running — the single-instance lock will handle that elsewhere.
 */
export function didCrashLastSession(): boolean {
  if (!existsSync(RUNNING_MARKER)) return false
  const pid = readRunningMarkerPid()
  if (pid === null) return true
  if (pid === process.pid) return true
  return !isProcessAlive(pid)
}

/**
 * Create the running marker on startup. Records the current PID so future
 * launches can tell whether a previous run actually crashed vs is still running.
 */
export async function createRunningMarker(): Promise<void> {
  await mkdir(WRANGLE_DIR, { recursive: true })
  await writeFile(RUNNING_MARKER, String(process.pid), 'utf-8')
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
