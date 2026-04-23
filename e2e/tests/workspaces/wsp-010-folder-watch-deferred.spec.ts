// Traces: WSP-010 (canonical spec: specs/workspaces/spec.md)
import { test, expect } from '../../fixtures'
import { launchWithCleanProfile } from '../../helpers/settings-helpers'
import {
  createTempWorkspaceFolder,
  removeTempFolder
} from '../../helpers/workspace-fs-helpers'

/**
 * WSP-010 is Deferred. Live folder-watching is not implemented; the IPC
 * channels are registered as no-op stubs that always resolve to true.
 * These tests lock in the current stub behaviour so that when WSP-010
 * becomes Active the expectations are intentionally updated alongside.
 */
test.describe('WSP-010: Folder Watch (Deferred)', () => {
  test('workspace:watchFolder is a no-op that resolves to true', async () => {
    const app = await launchWithCleanProfile()
    const folder = await createTempWorkspaceFolder()
    try {
      const result = await app.window.evaluate(
        async (p) => window.electron.workspace.watchFolder(p),
        folder
      )
      expect(result).toBe(true)
    } finally {
      await removeTempFolder(folder)
      await app.cleanup()
    }
  })

  test('workspace:unwatchFolder is a no-op that resolves to true', async () => {
    const app = await launchWithCleanProfile()
    const folder = await createTempWorkspaceFolder()
    try {
      const result = await app.window.evaluate(
        async (p) => window.electron.workspace.unwatchFolder(p),
        folder
      )
      expect(result).toBe(true)
    } finally {
      await removeTempFolder(folder)
      await app.cleanup()
    }
  })

  test('watchFolder is tolerant of non-existent paths (still returns true)', async () => {
    const app = await launchWithCleanProfile()
    try {
      const result = await app.window.evaluate(async () =>
        window.electron.workspace.watchFolder('C:/does-not-exist-wsp-010/__missing__')
      )
      expect(result).toBe(true)
    } finally {
      await app.cleanup()
    }
  })
})
