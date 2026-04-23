// Traces: WSP-001 (canonical spec: specs/workspaces/spec.md)
import { test, expect } from '../../fixtures'
import { launchWithCleanProfile } from '../../helpers/settings-helpers'
import {
  createTempWorkspaceFolder,
  removeTempFolder,
  seedWorkspaceTree,
  workspaceConfigPath,
  readJson
} from '../../helpers/workspace-fs-helpers'

/**
 * WSP-001 exposes a native folder-picker dialog. Driving the native picker
 * is not possible from Playwright without platform automation, so the
 * dialog-showing path itself is e2e/manual. The post-selection behaviour
 * (default config creation vs. existing config re-open) is exercised here
 * through the lower-level IPC channels (`workspace:loadConfig` and
 * `workspace:saveConfig`), which is what `workspace:openFolder` delegates
 * to after the dialog resolves.
 */
test.describe('WSP-001: Open Folder Dialog', () => {
  test('new folder gets a default config created and persisted', async () => {
    const app = await launchWithCleanProfile()
    const folder = await createTempWorkspaceFolder()
    try {
      // Simulate the post-dialog branch: no existing workspace.json -> default config is built & saved.
      // We replicate the handler's behaviour via IPC.
      const existing = await app.window.evaluate(
        async (p) => window.electron.workspace.loadConfig(p),
        folder
      )
      expect(existing).toBeNull()

      const defaultConfig = {
        id: `ws-${Date.now()}-abc1234`,
        name: folder.split(/[\\/]/).pop()!,
        color: '#4daafc',
        createdAt: Date.now(),
        lastOpenedAt: Date.now()
      }
      const saved = await app.window.evaluate(
        async ({ p, cfg }) => window.electron.workspace.saveConfig(p, cfg),
        { p: folder, cfg: defaultConfig }
      )
      expect(saved).toBe(true)

      const onDisk = await readJson<typeof defaultConfig>(workspaceConfigPath(folder))
      expect(onDisk).not.toBeNull()
      expect(onDisk!.id).toBe(defaultConfig.id)
      expect(onDisk!.name).toBe(defaultConfig.name)
      expect(onDisk!.color).toBe('#4daafc')
    } finally {
      await removeTempFolder(folder)
      await app.cleanup()
    }
  })

  test('existing folder: loadConfig returns the saved config shape', async () => {
    const app = await launchWithCleanProfile()
    const folder = await createTempWorkspaceFolder()
    try {
      const preExisting = {
        id: 'ws-preexisting-xyz',
        name: 'preexisting',
        color: '#f97316',
        createdAt: 1_700_000_000_000,
        lastOpenedAt: 1_700_000_000_000
      }
      await seedWorkspaceTree(folder, {
        '.wrangle/workspace.json': JSON.stringify(preExisting, null, 2)
      })

      const loaded = await app.window.evaluate(
        async (p) => window.electron.workspace.loadConfig(p),
        folder
      )
      expect(loaded).toEqual(preExisting)
    } finally {
      await removeTempFolder(folder)
      await app.cleanup()
    }
  })

  // The native folder-picker (dialog.showOpenDialog) and the cancel/error
  // branches of `workspace:openFolder` cannot be driven reliably from
  // Playwright. They are verified manually.
  test.describe.skip('WSP-001: manual verification (native dialog)', () => {
    test.skip('cancel resolves to null', () => {
      // 1. Trigger "Open Folder" from the menu.
      // 2. Click Cancel in the native picker.
      // 3. Verify the handler promise resolves to null and no workspace is added.
    })
    test.skip('error resolves to null and shows Electron errorBox', () => {
      // 1. Select a folder the app has no permission to read.
      // 2. Verify showErrorBox fires and the IPC promise resolves to null.
    })
  })
})
