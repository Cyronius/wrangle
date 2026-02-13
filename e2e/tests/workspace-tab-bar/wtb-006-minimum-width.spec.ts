import { test, expect, waitForAppReady } from '../../fixtures'
import { WorkspaceHelpers } from '../../helpers/workspace-helpers'

/**
 * WTB-006: Minimum Workspace Width
 *
 * Each visible workspace in the tab bar has a minimum width (140px) that ensures usability.
 */
test.describe('WTB-006: Minimum Workspace Width', () => {
  let workspaceHelpers: WorkspaceHelpers
  const MIN_WIDTH = 140 // From spec and TabBar.tsx

  test.beforeEach(async ({ window, electronApp }) => {
    await waitForAppReady(window)
    workspaceHelpers = new WorkspaceHelpers(window, electronApp)
  })

  test.afterEach(async () => {
    await workspaceHelpers.cleanup()
  })

  test('WTB-006: workspaces maintain minimum width with many workspaces', async ({ window }) => {
    // Create 5 workspaces with tabs
    const workspacePaths: string[] = []
    for (let i = 1; i <= 5; i++) {
      const wsPath = await workspaceHelpers.createTestWorkspace(`minwidth-ws-${i}`, 1)
      workspacePaths.push(wsPath)
    }

    // Add all workspaces
    for (const wsPath of workspacePaths) {
      await workspaceHelpers.addWorkspaceToApp(wsPath)
      await workspaceHelpers.openFileInWorkspace(wsPath, 'test-file-1.md')
    }

    await window.waitForTimeout(500)

    // Get widths of all visible tab groups
    const tabGroups = await workspaceHelpers.getVisibleTabGroups()

    // Verify all visible workspaces have at least minimum width
    for (const group of tabGroups) {
      expect(group.width).toBeGreaterThanOrEqual(MIN_WIDTH - 1) // Allow 1px tolerance
    }
  })

  test('WTB-006: CSS has correct minimum width set', async ({ window }) => {
    // Create a workspace to ensure tab-group exists
    const wsPath = await workspaceHelpers.createTestWorkspace('css-check-ws', 1)
    await workspaceHelpers.addWorkspaceToApp(wsPath)
    await workspaceHelpers.openFileInWorkspace(wsPath, 'test-file-1.md')

    await window.waitForTimeout(300)

    // Check CSS min-width property
    const minWidth = await window.evaluate(() => {
      const group = document.querySelector('.tab-group')
      if (!group) return null
      const style = window.getComputedStyle(group)
      return style.minWidth
    })

    expect(minWidth).toBeTruthy()
    // Should be 140px (or close to it)
    const numericWidth = parseInt(minWidth || '0')
    expect(numericWidth).toBeGreaterThanOrEqual(MIN_WIDTH - 10) // Allow some tolerance
  })

  test('WTB-006: minimum width takes precedence over equal division', async ({ window }) => {
    // Create many workspaces that would require less than min width each if divided equally
    const workspacePaths: string[] = []
    for (let i = 1; i <= 8; i++) {
      const wsPath = await workspaceHelpers.createTestWorkspace(`precedence-ws-${i}`, 1)
      workspacePaths.push(wsPath)
    }

    // Add all workspaces
    for (const wsPath of workspacePaths) {
      await workspaceHelpers.addWorkspaceToApp(wsPath)
      await workspaceHelpers.openFileInWorkspace(wsPath, 'test-file-1.md')
    }

    await window.waitForTimeout(500)

    // Get visible tab groups
    const tabGroups = await workspaceHelpers.getVisibleTabGroups()

    // All visible workspaces must be at least min width
    for (const group of tabGroups) {
      expect(group.width).toBeGreaterThanOrEqual(MIN_WIDTH - 1)
    }

    // If there are 8 workspaces and they can't all fit at min width,
    // some should go to overflow (tested in WTB-007)
  })
})
