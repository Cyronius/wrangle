import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'

/**
 * Filesystem helpers for specs/workspaces/ e2e tests.
 *
 * These tests exercise the `workspace:*` IPC handlers which read and write
 * real folders on disk. We create isolated temp folders per test and tear
 * them down afterwards.
 */

/**
 * Create an empty temp directory to be used as a workspace root.
 */
export async function createTempWorkspaceFolder(label = 'wrangle-wsp'): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), `${label}-`))
}

/**
 * Recursively remove a temp folder (best-effort).
 */
export async function removeTempFolder(folderPath: string): Promise<void> {
  try {
    await fs.rm(folderPath, { recursive: true, force: true, maxRetries: 5 })
  } catch {
    // best-effort
  }
}

/**
 * Create a set of files/folders inside a workspace root.
 * Entries use forward-slash separators; directories end with `/`.
 */
export async function seedWorkspaceTree(
  rootPath: string,
  entries: Record<string, string | null>
): Promise<void> {
  for (const [rel, content] of Object.entries(entries)) {
    const full = path.join(rootPath, rel.replace(/\//g, path.sep))
    if (rel.endsWith('/') || content === null) {
      await fs.mkdir(full, { recursive: true })
    } else {
      await fs.mkdir(path.dirname(full), { recursive: true })
      await fs.writeFile(full, content, 'utf-8')
    }
  }
}

/**
 * Read and parse a JSON file from disk, returning null if missing.
 */
export async function readJson<T = unknown>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(raw) as T
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw err
  }
}

/**
 * Path helpers mirroring src/main/utils/workspace-manager.ts constants.
 * Duplicated here to avoid importing main-process code into tests.
 */
export const WRANGLE_DIR = '.wrangle'
export const WORKSPACE_CONFIG_FILE = 'workspace.json'
export const SESSION_FILE = 'session.json'

export function workspaceConfigPath(folderPath: string): string {
  return path.join(folderPath, WRANGLE_DIR, WORKSPACE_CONFIG_FILE)
}

export function workspaceSessionPath(folderPath: string): string {
  return path.join(folderPath, WRANGLE_DIR, SESSION_FILE)
}

export function appSessionPath(): string {
  return path.join(os.homedir(), WRANGLE_DIR, 'app-session.json')
}

export function defaultSessionPath(): string {
  return path.join(os.homedir(), WRANGLE_DIR, 'default-session.json')
}

/**
 * Backup an existing file (if any) so a test can safely mutate it and
 * restore afterwards. Returns an async restore callback.
 */
export async function backupFile(filePath: string): Promise<() => Promise<void>> {
  let original: string | null = null
  try {
    original = await fs.readFile(filePath, 'utf-8')
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
  }
  return async () => {
    if (original === null) {
      try {
        await fs.unlink(filePath)
      } catch {
        // ignore
      }
    } else {
      await fs.mkdir(path.dirname(filePath), { recursive: true })
      await fs.writeFile(filePath, original, 'utf-8')
    }
  }
}
