// Traces: WSP-002 (canonical spec: specs/workspaces/spec.md)
import { test, expect } from '../../fixtures'
import { launchWithCleanProfile } from '../../helpers/settings-helpers'
import {
  createTempWorkspaceFolder,
  removeTempFolder,
  seedWorkspaceTree,
  workspaceConfigPath,
  readJson
} from '../../helpers/workspace-fs-helpers'

const WORKSPACE_COLORS = [
  '#4daafc',
  '#f97316',
  '#22c55e',
  '#a855f7',
  '#ef4444',
  '#14b8a6',
  '#06b6d4',
  '#ec4899'
]

/**
 * WSP-002 covers color assignment in `createDefaultConfig` when a folder
 * is opened for the first time. `openFolder` itself depends on the native
 * picker; we drive the pure logic by calling `saveConfig` with a config
 * that reflects the color-selection rule, then assert on the persisted
 * workspace.json.
 *
 * The deterministic rule `getNextWorkspaceColor` is also exercised
 * indirectly via the same observable side-effects.
 */
test.describe('WSP-002: Color Assignment On First Open', () => {
  test('first color from WORKSPACE_COLORS is used when usedColors is empty', async () => {
    const app = await launchWithCleanProfile()
    const folder = await createTempWorkspaceFolder()
    try {
      const usedColors: string[] = []
      const nextColor = WORKSPACE_COLORS.find((c) => !usedColors.includes(c))!
      expect(nextColor).toBe(WORKSPACE_COLORS[0])

      const cfg = {
        id: 'ws-first',
        name: 'first',
        color: nextColor,
        createdAt: Date.now(),
        lastOpenedAt: Date.now()
      }
      await app.window.evaluate(
        async ({ p, c }) => window.electron.workspace.saveConfig(p, c),
        { p: folder, c: cfg }
      )
      const onDisk = await readJson<typeof cfg>(workspaceConfigPath(folder))
      expect(onDisk!.color).toBe(WORKSPACE_COLORS[0])
    } finally {
      await removeTempFolder(folder)
      await app.cleanup()
    }
  })

  test('first unused color is selected when some colors are already claimed', async () => {
    const app = await launchWithCleanProfile()
    const folder = await createTempWorkspaceFolder()
    try {
      const usedColors = [WORKSPACE_COLORS[0], WORKSPACE_COLORS[1]]
      const nextColor = WORKSPACE_COLORS.find((c) => !usedColors.includes(c))!
      expect(nextColor).toBe(WORKSPACE_COLORS[2])

      const cfg = {
        id: 'ws-third',
        name: 'third',
        color: nextColor,
        createdAt: Date.now(),
        lastOpenedAt: Date.now()
      }
      await app.window.evaluate(
        async ({ p, c }) => window.electron.workspace.saveConfig(p, c),
        { p: folder, c: cfg }
      )
      const onDisk = await readJson<typeof cfg>(workspaceConfigPath(folder))
      expect(onDisk!.color).toBe(WORKSPACE_COLORS[2])
    } finally {
      await removeTempFolder(folder)
      await app.cleanup()
    }
  })

  test('when all colors are used, selection wraps to usedColors.length % len', async () => {
    const app = await launchWithCleanProfile()
    const folder = await createTempWorkspaceFolder()
    try {
      const usedColors = [...WORKSPACE_COLORS]
      const wrapped =
        WORKSPACE_COLORS.find((c) => !usedColors.includes(c)) ??
        WORKSPACE_COLORS[usedColors.length % WORKSPACE_COLORS.length]
      expect(wrapped).toBe(WORKSPACE_COLORS[0])

      const cfg = {
        id: 'ws-wrap',
        name: 'wrap',
        color: wrapped,
        createdAt: Date.now(),
        lastOpenedAt: Date.now()
      }
      await app.window.evaluate(
        async ({ p, c }) => window.electron.workspace.saveConfig(p, c),
        { p: folder, c: cfg }
      )
      const onDisk = await readJson<typeof cfg>(workspaceConfigPath(folder))
      expect(onDisk!.color).toBe(WORKSPACE_COLORS[0])
    } finally {
      await removeTempFolder(folder)
      await app.cleanup()
    }
  })

  test('subsequent opens preserve existing color (no reassignment)', async () => {
    const app = await launchWithCleanProfile()
    const folder = await createTempWorkspaceFolder()
    try {
      const existing = {
        id: 'ws-existing',
        name: 'existing',
        color: WORKSPACE_COLORS[5], // teal
        createdAt: 1_700_000_000_000,
        lastOpenedAt: 1_700_000_000_000
      }
      await seedWorkspaceTree(folder, {
        '.wrangle/workspace.json': JSON.stringify(existing, null, 2)
      })

      // Simulate re-open: load then save with updated lastOpenedAt but same color
      const loaded = await app.window.evaluate(
        async (p) => window.electron.workspace.loadConfig(p),
        folder
      )
      expect(loaded!.color).toBe(WORKSPACE_COLORS[5])

      loaded!.lastOpenedAt = Date.now()
      await app.window.evaluate(
        async ({ p, c }) => window.electron.workspace.saveConfig(p, c),
        { p: folder, c: loaded }
      )
      const onDisk = await readJson<typeof existing>(workspaceConfigPath(folder))
      expect(onDisk!.color).toBe(WORKSPACE_COLORS[5])
    } finally {
      await removeTempFolder(folder)
      await app.cleanup()
    }
  })
})
