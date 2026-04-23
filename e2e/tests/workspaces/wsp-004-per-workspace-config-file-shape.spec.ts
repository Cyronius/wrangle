// Traces: WSP-004 (canonical spec: specs/workspaces/spec.md)
import { test, expect } from '../../fixtures'
import { promises as fs } from 'fs'
import path from 'path'
import { launchWithCleanProfile } from '../../helpers/settings-helpers'
import {
  createTempWorkspaceFolder,
  removeTempFolder,
  seedWorkspaceTree,
  workspaceConfigPath,
  WRANGLE_DIR,
  WORKSPACE_CONFIG_FILE
} from '../../helpers/workspace-fs-helpers'

interface WsConfig {
  id: string
  name: string
  color: string
  createdAt: number
  lastOpenedAt: number
}

test.describe('WSP-004: Per-Workspace Config File Shape', () => {
  test('config is stored at .wrangle/workspace.json as 2-space indented UTF-8 JSON', async () => {
    const app = await launchWithCleanProfile()
    const folder = await createTempWorkspaceFolder()
    try {
      const cfg: WsConfig = {
        id: 'ws-shape-1',
        name: 'shape',
        color: '#22c55e',
        createdAt: 1_700_000_000_000,
        lastOpenedAt: 1_700_000_000_000
      }
      await app.window.evaluate(
        async ({ p, c }) => window.electron.workspace.saveConfig(p, c),
        { p: folder, c: cfg }
      )

      const expectedPath = path.join(folder, WRANGLE_DIR, WORKSPACE_CONFIG_FILE)
      expect(workspaceConfigPath(folder)).toBe(expectedPath)

      const raw = await fs.readFile(expectedPath, 'utf-8')
      expect(raw).toBe(JSON.stringify(cfg, null, 2))
      expect(raw.includes('\n  "id"')).toBe(true) // 2-space indent
    } finally {
      await removeTempFolder(folder)
      await app.cleanup()
    }
  })

  test('.wrangle directory is created lazily on first saveConfig', async () => {
    const app = await launchWithCleanProfile()
    const folder = await createTempWorkspaceFolder()
    try {
      const wrangleDir = path.join(folder, WRANGLE_DIR)
      // Directory must not exist before save.
      let exists = false
      try {
        await fs.access(wrangleDir)
        exists = true
      } catch {
        exists = false
      }
      expect(exists).toBe(false)

      await app.window.evaluate(
        async (p) =>
          window.electron.workspace.saveConfig(p, {
            id: 'ws-lazy',
            name: 'lazy',
            color: '#4daafc',
            createdAt: Date.now(),
            lastOpenedAt: Date.now()
          }),
        folder
      )

      await fs.access(wrangleDir) // throws if missing
      await fs.access(path.join(wrangleDir, WORKSPACE_CONFIG_FILE))
    } finally {
      await removeTempFolder(folder)
      await app.cleanup()
    }
  })

  test('loadConfig returns null when workspace.json is absent', async () => {
    const app = await launchWithCleanProfile()
    const folder = await createTempWorkspaceFolder()
    try {
      const result = await app.window.evaluate(
        async (p) => window.electron.workspace.loadConfig(p),
        folder
      )
      expect(result).toBeNull()
    } finally {
      await removeTempFolder(folder)
      await app.cleanup()
    }
  })

  test('loadConfig returns null when workspace.json is unparseable', async () => {
    const app = await launchWithCleanProfile()
    const folder = await createTempWorkspaceFolder()
    try {
      await seedWorkspaceTree(folder, {
        '.wrangle/workspace.json': '{ this is not: valid json'
      })
      const result = await app.window.evaluate(
        async (p) => window.electron.workspace.loadConfig(p),
        folder
      )
      expect(result).toBeNull()
    } finally {
      await removeTempFolder(folder)
      await app.cleanup()
    }
  })

  test('saved config round-trips through load with the full required shape', async () => {
    const app = await launchWithCleanProfile()
    const folder = await createTempWorkspaceFolder()
    try {
      const cfg: WsConfig = {
        id: 'ws-round-trip-abc',
        name: 'round',
        color: '#a855f7',
        createdAt: 1_650_000_000_000,
        lastOpenedAt: 1_660_000_000_000
      }
      await app.window.evaluate(
        async ({ p, c }) => window.electron.workspace.saveConfig(p, c),
        { p: folder, c: cfg }
      )
      const loaded = await app.window.evaluate(
        async (p) => window.electron.workspace.loadConfig(p),
        folder
      )
      expect(loaded).toEqual(cfg)
      expect(typeof loaded!.id).toBe('string')
      expect(typeof loaded!.name).toBe('string')
      expect(typeof loaded!.color).toBe('string')
      expect(typeof loaded!.createdAt).toBe('number')
      expect(typeof loaded!.lastOpenedAt).toBe('number')
    } finally {
      await removeTempFolder(folder)
      await app.cleanup()
    }
  })
})
