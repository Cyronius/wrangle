// Traces: WSP-003 (canonical spec: specs/workspaces/spec.md)
import { test, expect } from '../../fixtures'
import { launchWithCleanProfile } from '../../helpers/settings-helpers'
import {
  createTempWorkspaceFolder,
  removeTempFolder,
  seedWorkspaceTree,
  workspaceConfigPath,
  readJson
} from '../../helpers/workspace-fs-helpers'

interface WsConfig {
  id: string
  name: string
  color: string
  createdAt: number
  lastOpenedAt: number
}

test.describe('WSP-003: lastOpenedAt Updated On Re-Open', () => {
  test('re-opening refreshes lastOpenedAt and persists it to workspace.json', async () => {
    const app = await launchWithCleanProfile()
    const folder = await createTempWorkspaceFolder()
    try {
      const original: WsConfig = {
        id: 'ws-reopen',
        name: 'reopen',
        color: '#4daafc',
        createdAt: 1_700_000_000_000,
        lastOpenedAt: 1_700_000_000_000
      }
      await seedWorkspaceTree(folder, {
        '.wrangle/workspace.json': JSON.stringify(original, null, 2)
      })

      const beforeReopen = Date.now()
      // Simulate re-open (what workspace:openFolder does internally).
      const loaded = await app.window.evaluate<WsConfig | null, string>(
        async (p) => window.electron.workspace.loadConfig(p),
        folder
      )
      expect(loaded).not.toBeNull()
      loaded!.lastOpenedAt = Date.now()
      await app.window.evaluate(
        async ({ p, c }) => window.electron.workspace.saveConfig(p, c),
        { p: folder, c: loaded }
      )

      const afterReopen = Date.now()
      const onDisk = await readJson<WsConfig>(workspaceConfigPath(folder))
      expect(onDisk).not.toBeNull()
      expect(onDisk!.lastOpenedAt).toBeGreaterThanOrEqual(beforeReopen)
      expect(onDisk!.lastOpenedAt).toBeLessThanOrEqual(afterReopen)
      expect(onDisk!.lastOpenedAt).toBeGreaterThan(original.lastOpenedAt)
    } finally {
      await removeTempFolder(folder)
      await app.cleanup()
    }
  })

  test('createdAt, id, name, and color are preserved across re-open', async () => {
    const app = await launchWithCleanProfile()
    const folder = await createTempWorkspaceFolder()
    try {
      const original: WsConfig = {
        id: 'ws-keep-these',
        name: 'keepme',
        color: '#ec4899',
        createdAt: 1_650_000_000_000,
        lastOpenedAt: 1_650_000_000_000
      }
      await seedWorkspaceTree(folder, {
        '.wrangle/workspace.json': JSON.stringify(original, null, 2)
      })

      const loaded = await app.window.evaluate<WsConfig | null, string>(
        async (p) => window.electron.workspace.loadConfig(p),
        folder
      )
      loaded!.lastOpenedAt = Date.now()
      await app.window.evaluate(
        async ({ p, c }) => window.electron.workspace.saveConfig(p, c),
        { p: folder, c: loaded }
      )

      const onDisk = await readJson<WsConfig>(workspaceConfigPath(folder))
      expect(onDisk!.id).toBe(original.id)
      expect(onDisk!.name).toBe(original.name)
      expect(onDisk!.color).toBe(original.color)
      expect(onDisk!.createdAt).toBe(original.createdAt)
    } finally {
      await removeTempFolder(folder)
      await app.cleanup()
    }
  })
})
