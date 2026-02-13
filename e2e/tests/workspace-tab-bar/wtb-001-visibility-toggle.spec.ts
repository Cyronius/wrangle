import { test, expect, waitForAppReady } from '../../fixtures'
import { WorkspaceHelpers } from '../../helpers/workspace-helpers'

/**
 * WTB-001: Workspace Visibility Toggle
 *
 * Clicking a workspace in the left sidebar toggles whether that workspace's
 * tabs appear in the tab bar.
 */
test.describe('WTB-001: Workspace Visibility Toggle', () => {
  let workspaceHelpers: WorkspaceHelpers
  let workspace1Path: string
  let workspace2Path: string
  let workspace3Path: string

  test.beforeEach(async ({ window, electronApp }) => {
    await waitForAppReady(window)
    workspaceHelpers = new WorkspaceHelpers(window, electronApp)

    // Create test workspaces
    workspace1Path = await workspaceHelpers.createTestWorkspace('test-ws-1', 2)
    workspace2Path = await workspaceHelpers.createTestWorkspace('test-ws-2', 2)
    workspace3Path = await workspaceHelpers.createTestWorkspace('test-ws-3', 2)

    // Add workspaces and open files to create tabs
    await workspaceHelpers.addWorkspaceToApp(workspace1Path)
    await workspaceHelpers.openFileInWorkspace(workspace1Path, 'test-file-1.md')

    await workspaceHelpers.addWorkspaceToApp(workspace2Path)
    await workspaceHelpers.openFileInWorkspace(workspace2Path, 'test-file-1.md')

    await workspaceHelpers.addWorkspaceToApp(workspace3Path)
    await workspaceHelpers.openFileInWorkspace(workspace3Path, 'test-file-1.md')

    // Wait for UI to update
    await window.waitForTimeout(300)
  })

  test.afterEach(async () => {
    await workspaceHelpers.cleanup()
  })

  test('WTB-001: all workspaces with tabs are visible in tab bar by default', async ({ window }) => {
    // All 3 workspaces should have their tab groups visible
    const tabGroupCount = await workspaceHelpers.getVisibleTabGroupCount()
    expect(tabGroupCount).toBe(3)
  })

  test('WTB-001: clicking active workspace hides its tabs from tab bar', async ({ window }) => {
    // Get initial count
    const initialCount = await workspaceHelpers.getVisibleTabGroupCount()
    expect(initialCount).toBe(3)

    // Click the active workspace (test-ws-3 is last added, so it's active)
    await workspaceHelpers.clickWorkspaceInSidebar('test-ws-3')

    // Wait for state update
    await window.waitForTimeout(200)

    // Should now have 2 visible tab groups
    const afterCount = await workspaceHelpers.getVisibleTabGroupCount()
    expect(afterCount).toBe(2)
  })

  test('WTB-001: clicking inactive workspace shows it and makes it active', async ({ window }) => {
    // First hide the active workspace to have only 2 visible
    await workspaceHelpers.clickWorkspaceInSidebar('test-ws-3')
    await window.waitForTimeout(200)

    const beforeCount = await workspaceHelpers.getVisibleTabGroupCount()
    expect(beforeCount).toBe(2)

    // Click test-ws-3 again to show it (it was hidden)
    await workspaceHelpers.clickWorkspaceInSidebar('test-ws-3')
    await window.waitForTimeout(200)

    // Should now have 3 visible tab groups again
    const afterCount = await workspaceHelpers.getVisibleTabGroupCount()
    expect(afterCount).toBe(3)
  })

  test('WTB-001: other workspaces remain visible when one is hidden', async ({ window }) => {
    // Hide workspace 1
    await workspaceHelpers.clickWorkspaceInSidebar('test-ws-1')
    await window.waitForTimeout(100)

    // Make ws-1 active first (clicking it again)
    await workspaceHelpers.clickWorkspaceInSidebar('test-ws-1')
    await window.waitForTimeout(100)

    // Now click to hide it
    await workspaceHelpers.clickWorkspaceInSidebar('test-ws-1')
    await window.waitForTimeout(200)

    // Verify workspace 2 and 3 are still visible
    const tabGroups = await workspaceHelpers.getVisibleTabGroups()

    // Should have 2 remaining
    expect(tabGroups.length).toBe(2)
  })

  test('WTB-001: workspace with no tabs does not appear in tab bar', async ({ window }) => {
    // Create a workspace with no files opened
    const emptyWorkspacePath = await workspaceHelpers.createTestWorkspace('empty-ws', 1)
    await workspaceHelpers.addWorkspaceToApp(emptyWorkspacePath)
    // Note: Not opening any files, so no tabs

    await window.waitForTimeout(200)

    // Should still have 3 tab groups (empty workspace shouldn't appear)
    const tabGroupCount = await workspaceHelpers.getVisibleTabGroupCount()
    expect(tabGroupCount).toBe(3)
  })

  test('WTB-001: hiding active workspace activates next visible workspace', async ({ window }) => {
    // Get the active workspace indicator before hiding
    const activeWorkspaceBefore = await window.$('.workspace-bar-item.active')
    const activeNameBefore = await activeWorkspaceBefore?.textContent()

    // Hide the active workspace
    await workspaceHelpers.clickWorkspaceInSidebar(activeNameBefore || 'test-ws-3')
    await window.waitForTimeout(200)

    // Get the new active workspace
    const activeWorkspaceAfter = await window.$('.workspace-bar-item.active')
    const activeNameAfter = await activeWorkspaceAfter?.textContent()

    // The active workspace should have changed
    expect(activeNameAfter).not.toBe(activeNameBefore)
  })
})
