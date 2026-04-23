// Traces: WSP-005 (canonical spec: specs/workspaces/spec.md)
import { test, expect } from '../../fixtures'
import { promises as fs } from 'fs'
import path from 'path'
import { launchWithCleanProfile } from '../../helpers/settings-helpers'
import {
  createTempWorkspaceFolder,
  removeTempFolder,
  seedWorkspaceTree,
  workspaceSessionPath,
  WRANGLE_DIR,
  SESSION_FILE
} from '../../helpers/workspace-fs-helpers'

test.describe('WSP-005: Per-Workspace Session File Shape', () => {
  test('session is stored at .wrangle/session.json as 2-space indented UTF-8 JSON', async () => {
    const app = await launchWithCleanProfile()
    const folder = await createTempWorkspaceFolder()
    try {
      const session = {
        openTabs: [
          { id: 't1', path: path.join(folder, 'a.md'), scrollTop: 0 },
          { id: 't2', path: path.join(folder, 'b.md'), scrollTop: 120 }
        ],
        activeTabId: 't2'
      }
      const ok = await app.window.evaluate(
        async ({ p, s }) => window.electron.workspace.saveSession(p, s as never),
        { p: folder, s: session }
      )
      expect(ok).toBe(true)

      const expectedPath = path.join(folder, WRANGLE_DIR, SESSION_FILE)
      expect(workspaceSessionPath(folder)).toBe(expectedPath)

      const raw = await fs.readFile(expectedPath, 'utf-8')
      expect(raw).toBe(JSON.stringify(session, null, 2))
      expect(raw.includes('\n  "openTabs"')).toBe(true) // 2-space indent
    } finally {
      await removeTempFolder(folder)
      await app.cleanup()
    }
  })

  test('.wrangle directory is created lazily on first saveSession', async () => {
    const app = await launchWithCleanProfile()
    const folder = await createTempWorkspaceFolder()
    try {
      const wrangleDir = path.join(folder, WRANGLE_DIR)
      let exists = false
      try {
        await fs.access(wrangleDir)
        exists = true
      } catch {
        exists = false
      }
      expect(exists).toBe(false)

      await app.window.evaluate(
        async (p) => window.electron.workspace.saveSession(p, {} as never),
        folder
      )

      await fs.access(wrangleDir)
      await fs.access(path.join(wrangleDir, SESSION_FILE))
    } finally {
      await removeTempFolder(folder)
      await app.cleanup()
    }
  })

  test('loadSession returns null when session.json is absent', async () => {
    const app = await launchWithCleanProfile()
    const folder = await createTempWorkspaceFolder()
    try {
      const result = await app.window.evaluate(
        async (p) => window.electron.workspace.loadSession(p),
        folder
      )
      expect(result).toBeNull()
    } finally {
      await removeTempFolder(folder)
      await app.cleanup()
    }
  })

  test('loadSession returns null when session.json is unparseable', async () => {
    const app = await launchWithCleanProfile()
    const folder = await createTempWorkspaceFolder()
    try {
      await seedWorkspaceTree(folder, {
        '.wrangle/session.json': '{ totally [broken'
      })
      const result = await app.window.evaluate(
        async (p) => window.electron.workspace.loadSession(p),
        folder
      )
      expect(result).toBeNull()
    } finally {
      await removeTempFolder(folder)
      await app.cleanup()
    }
  })

  test('saved session round-trips through loadSession with the same JSON contents', async () => {
    const app = await launchWithCleanProfile()
    const folder = await createTempWorkspaceFolder()
    try {
      const session = {
        openTabs: [{ id: 't1', filename: 'readme.md', content: '# hi', isDirty: false }],
        activeTabId: 't1',
        viewMode: 'split'
      }
      await app.window.evaluate(
        async ({ p, s }) => window.electron.workspace.saveSession(p, s as never),
        { p: folder, s: session }
      )
      const loaded = await app.window.evaluate(
        async (p) => window.electron.workspace.loadSession(p),
        folder
      )
      expect(loaded).toEqual(session)
    } finally {
      await removeTempFolder(folder)
      await app.cleanup()
    }
  })
})
