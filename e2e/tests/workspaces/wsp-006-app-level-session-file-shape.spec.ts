// Traces: WSP-006 (canonical spec: specs/workspaces/spec.md)
import { test, expect } from '../../fixtures'
import { promises as fs } from 'fs'
import { launchWithCleanProfile } from '../../helpers/settings-helpers'
import {
  appSessionPath,
  defaultSessionPath,
  backupFile
} from '../../helpers/workspace-fs-helpers'

/**
 * WSP-006 persists to `~/.wrangle/app-session.json` and
 * `~/.wrangle/default-session.json`. These are not under Electron's
 * userData dir, so there is no hermetic isolation available today.
 * Each test backs up any pre-existing file on the host and restores it
 * in a `finally` block so the developer's real session is preserved.
 */
test.describe('WSP-006: App-Level Session File Shape', () => {
  test('saveAppSession writes 2-space indented JSON at ~/.wrangle/app-session.json', async () => {
    const restore = await backupFile(appSessionPath())
    const app = await launchWithCleanProfile()
    try {
      const session = {
        openWorkspaces: ['/tmp/fake-ws-a', '/tmp/fake-ws-b'],
        activeWorkspacePath: '/tmp/fake-ws-a',
        lastSavedAt: 1_700_000_000_000,
        expandedWorkspacePaths: ['/tmp/fake-ws-a'],
        openFilesExpanded: true
      }

      const ok = await app.window.evaluate(
        async (s) => window.electron.workspace.saveAppSession(s as never),
        session
      )
      expect(ok).toBe(true)

      const raw = await fs.readFile(appSessionPath(), 'utf-8')
      expect(raw).toBe(JSON.stringify(session, null, 2))
      expect(raw.includes('\n  "openWorkspaces"')).toBe(true)
    } finally {
      await app.cleanup()
      await restore()
    }
  })

  test('loadAppSession round-trips the AppSession shape including optional fields', async () => {
    const restore = await backupFile(appSessionPath())
    const app = await launchWithCleanProfile()
    try {
      const session = {
        openWorkspaces: ['/tmp/ws-1'],
        activeWorkspacePath: '/tmp/ws-1',
        lastSavedAt: 1_700_000_000_000,
        expandedWorkspacePaths: ['/tmp/ws-1'],
        openFilesExpanded: false,
        // Deprecated fields must round-trip untouched (backward compat)
        visibleWorkspacePaths: ['/tmp/ws-1'],
        focusedPaneWorkspacePath: '/tmp/ws-1'
      }
      await app.window.evaluate(
        async (s) => window.electron.workspace.saveAppSession(s as never),
        session
      )

      const loaded = await app.window.evaluate(async () =>
        window.electron.workspace.loadAppSession()
      )
      expect(loaded).toEqual(session)
      expect(Array.isArray(loaded!.openWorkspaces)).toBe(true)
      expect(typeof loaded!.lastSavedAt).toBe('number')
    } finally {
      await app.cleanup()
      await restore()
    }
  })

  test('loadAppSession returns null when the file is absent', async () => {
    const restore = await backupFile(appSessionPath())
    // Ensure the file is missing for this test.
    try {
      await fs.unlink(appSessionPath())
    } catch {
      // ignore
    }
    const app = await launchWithCleanProfile()
    try {
      const loaded = await app.window.evaluate(async () =>
        window.electron.workspace.loadAppSession()
      )
      expect(loaded).toBeNull()
    } finally {
      await app.cleanup()
      await restore()
    }
  })

  test('loadAppSession returns null when the file is unparseable', async () => {
    const restore = await backupFile(appSessionPath())
    const app = await launchWithCleanProfile()
    try {
      // Corrupt the file on disk.
      await fs.mkdir(require('path').dirname(appSessionPath()), { recursive: true })
      await fs.writeFile(appSessionPath(), '{not json', 'utf-8')

      const loaded = await app.window.evaluate(async () =>
        window.electron.workspace.loadAppSession()
      )
      expect(loaded).toBeNull()
    } finally {
      await app.cleanup()
      await restore()
    }
  })

  test('default-session.json uses the same 2-space JSON contract', async () => {
    const restore = await backupFile(defaultSessionPath())
    const app = await launchWithCleanProfile()
    try {
      const defaultSession = {
        openTabs: [{ id: 'untitled-1', filename: 'Untitled', content: '', isDirty: false }],
        activeTabId: 'untitled-1'
      }
      const ok = await app.window.evaluate(
        async (s) => window.electron.workspace.saveDefaultSession(s as never),
        defaultSession
      )
      expect(ok).toBe(true)

      const raw = await fs.readFile(defaultSessionPath(), 'utf-8')
      expect(raw).toBe(JSON.stringify(defaultSession, null, 2))

      const loaded = await app.window.evaluate(async () =>
        window.electron.workspace.loadDefaultSession()
      )
      expect(loaded).toEqual(defaultSession)
    } finally {
      await app.cleanup()
      await restore()
    }
  })

  test('persists across app relaunch (openWorkspaces survive restart)', async () => {
    const restore = await backupFile(appSessionPath())
    const app1 = await launchWithCleanProfile()
    const session = {
      openWorkspaces: ['/tmp/relaunch-a', '/tmp/relaunch-b'],
      activeWorkspacePath: '/tmp/relaunch-b',
      lastSavedAt: Date.now()
    }
    try {
      const ok = await app1.window.evaluate(
        async (s) => window.electron.workspace.saveAppSession(s as never),
        session
      )
      expect(ok).toBe(true)
    } finally {
      await app1.cleanup()
    }

    const app2 = await launchWithCleanProfile()
    try {
      const loaded = await app2.window.evaluate(async () =>
        window.electron.workspace.loadAppSession()
      )
      expect(loaded).not.toBeNull()
      expect(loaded!.openWorkspaces).toEqual(session.openWorkspaces)
      expect(loaded!.activeWorkspacePath).toBe(session.activeWorkspacePath)
    } finally {
      await app2.cleanup()
      await restore()
    }
  })
})
