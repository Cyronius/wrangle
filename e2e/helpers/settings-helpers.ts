import { _electron as electron, ElectronApplication, Page } from '@playwright/test'
import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'

/**
 * Helpers for settings-persistence e2e tests.
 *
 * STG requirements need tests that launch Electron with an isolated userData
 * directory so settings.json writes don't pollute the host and so we can
 * relaunch against the same profile to verify persistence.
 */

export interface LaunchedApp {
  electronApp: ElectronApplication
  window: Page
  userDataDir: string
  cleanup: () => Promise<void>
}

/**
 * Create a fresh temp directory to use as Electron's userData dir.
 * Returns an absolute path that is guaranteed to exist and be empty.
 */
export async function createTempUserDataDir(label = 'wrangle-e2e'): Promise<string> {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), `${label}-`))
  return base
}

/**
 * Launch Electron with a clean, isolated userData directory.
 *
 * Uses Electron's built-in `--user-data-dir` command-line switch so that
 * `app.getPath('userData')` (and therefore electron-store's default location)
 * points at the supplied temp directory. This lets us:
 *   - verify first-launch defaults
 *   - mutate settings.json on disk between launches
 *   - relaunch and assert that persisted state is restored
 */
export async function launchWithCleanProfile(options?: {
  userDataDir?: string
}): Promise<LaunchedApp> {
  const appPath = path.resolve(__dirname, '../../out/main/index.js')
  const electronExecutable = process.platform === 'win32' ? 'electron.exe' : 'electron'
  const electronPath = path.resolve(
    __dirname,
    `../../node_modules/electron/dist/${electronExecutable}`
  )

  const userDataDir = options?.userDataDir ?? (await createTempUserDataDir())

  const cleanEnv = { ...process.env }
  delete cleanEnv.ELECTRON_RUN_AS_NODE

  const electronApp = await electron.launch({
    executablePath: electronPath,
    args: [appPath, `--user-data-dir=${userDataDir}`],
    env: {
      ...cleanEnv,
      NODE_ENV: 'test'
    }
  })

  const window = await electronApp.firstWindow()
  await window.waitForLoadState('domcontentloaded')

  const cleanup = async (): Promise<void> => {
    try {
      await electronApp.close()
    } catch {
      // ignore — may already be closed
    }
    try {
      await fs.rm(userDataDir, { recursive: true, force: true, maxRetries: 5 })
    } catch {
      // best-effort cleanup
    }
  }

  return { electronApp, window, userDataDir, cleanup }
}

/**
 * Compute the absolute path to settings.json within a given userData dir.
 * electron-store with { name: 'settings' } writes to `<userData>/settings.json`.
 */
export function settingsFilePath(userDataDir: string): string {
  return path.join(userDataDir, 'settings.json')
}

/**
 * Read and parse settings.json from disk. Returns null if the file does not
 * yet exist.
 */
export async function readSettingsFile(userDataDir: string): Promise<Record<string, unknown> | null> {
  const p = settingsFilePath(userDataDir)
  try {
    const raw = await fs.readFile(p, 'utf-8')
    return JSON.parse(raw) as Record<string, unknown>
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw err
  }
}

/**
 * Poll the settings file until the provided predicate is satisfied, or until
 * the timeout is reached. Useful because electron-store writes are async /
 * debounced.
 */
export async function waitForSettingsFile(
  userDataDir: string,
  predicate: (data: Record<string, unknown> | null) => boolean,
  timeoutMs = 5000,
  intervalMs = 100
): Promise<Record<string, unknown> | null> {
  const deadline = Date.now() + timeoutMs
  let last: Record<string, unknown> | null = null
  while (Date.now() < deadline) {
    last = await readSettingsFile(userDataDir)
    if (predicate(last)) return last
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  return last
}

/**
 * Write a settings.json file directly (used to seed a profile before launch).
 */
export async function writeSettingsFile(
  userDataDir: string,
  data: Record<string, unknown>
): Promise<void> {
  await fs.mkdir(userDataDir, { recursive: true })
  await fs.writeFile(settingsFilePath(userDataDir), JSON.stringify(data, null, 2), 'utf-8')
}
