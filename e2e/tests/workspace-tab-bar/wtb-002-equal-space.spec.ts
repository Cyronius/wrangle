// Traces: WTB-002 (canonical spec: specs/workspace-tab-bar/spec.md)
import { test, expect, waitForAppReady } from '../../fixtures'
import { WorkspaceHelpers } from '../../helpers/workspace-helpers'

/**
 * WTB-002: Equal Space Allocation Per Workspace
 *
 * The tab bar's horizontal width is divided equally among all visible workspaces.
 */
test.describe('WTB-002: Equal Space Allocation Per Workspace', () => {
  let workspaceHelpers: WorkspaceHelpers

  test.beforeEach(async ({ window, electronApp }) => {
    await waitForAppReady(window)
    workspaceHelpers = new WorkspaceHelpers(window, electronApp)
  })

  test.afterEach(async () => {
    await workspaceHelpers.cleanup()
  })

  test('WTB-002: two workspaces get equal width', async ({ window }) => {
    // Create 2 workspaces with tabs
    const ws1Path = await workspaceHelpers.createTestWorkspace('equal-ws-1', 2)
    const ws2Path = await workspaceHelpers.createTestWorkspace('equal-ws-2', 2)

    await workspaceHelpers.addWorkspaceToApp(ws1Path)
    await workspaceHelpers.openFileInWorkspace(ws1Path, 'test-file-1.md')

    await workspaceHelpers.addWorkspaceToApp(ws2Path)
    await workspaceHelpers.openFileInWorkspace(ws2Path, 'test-file-1.md')

    await window.waitForTimeout(300)

    // Get widths of both tab groups
    const tabGroups = await workspaceHelpers.getVisibleTabGroups()
    expect(tabGroups.length).toBe(2)

    const width1 = tabGroups[0].width
    const width2 = tabGroups[1].width

    // Widths should be equal within 2px tolerance
    expect(Math.abs(width1 - width2)).toBeLessThanOrEqual(2)
  })

  test('WTB-002: three workspaces get equal width', async ({ window }) => {
    // Create 3 workspaces with tabs
    const ws1Path = await workspaceHelpers.createTestWorkspace('triple-ws-1', 1)
    const ws2Path = await workspaceHelpers.createTestWorkspace('triple-ws-2', 1)
    const ws3Path = await workspaceHelpers.createTestWorkspace('triple-ws-3', 1)

    await workspaceHelpers.addWorkspaceToApp(ws1Path)
    await workspaceHelpers.openFileInWorkspace(ws1Path, 'test-file-1.md')

    await workspaceHelpers.addWorkspaceToApp(ws2Path)
    await workspaceHelpers.openFileInWorkspace(ws2Path, 'test-file-1.md')

    await workspaceHelpers.addWorkspaceToApp(ws3Path)
    await workspaceHelpers.openFileInWorkspace(ws3Path, 'test-file-1.md')

    await window.waitForTimeout(300)

    // Get widths of all tab groups
    const tabGroups = await workspaceHelpers.getVisibleTabGroups()
    expect(tabGroups.length).toBe(3)

    const widths = tabGroups.map(g => g.width)

    // All widths should be equal within 2px tolerance
    for (let i = 1; i < widths.length; i++) {
      expect(Math.abs(widths[0] - widths[i])).toBeLessThanOrEqual(2)
    }
  })

  test('WTB-002: equal width regardless of tab count', async ({ window }) => {
    // Create 2 workspaces with different tab counts
    const ws1Path = await workspaceHelpers.createTestWorkspace('many-tabs-ws', 10)
    const ws2Path = await workspaceHelpers.createTestWorkspace('few-tabs-ws', 2)

    // Add workspace 1 with 10 tabs
    await workspaceHelpers.addWorkspaceToApp(ws1Path)
    for (let i = 1; i <= 10; i++) {
      await workspaceHelpers.openFileInWorkspace(ws1Path, `test-file-${i}.md`)
    }

    // Add workspace 2 with 1 tab
    await workspaceHelpers.addWorkspaceToApp(ws2Path)
    await workspaceHelpers.openFileInWorkspace(ws2Path, 'test-file-1.md')

    await window.waitForTimeout(300)

    // Get widths
    const tabGroups = await workspaceHelpers.getVisibleTabGroups()
    expect(tabGroups.length).toBe(2)

    const width1 = tabGroups[0].width
    const width2 = tabGroups[1].width

    // Widths should be equal despite different tab counts
    expect(Math.abs(width1 - width2)).toBeLessThanOrEqual(2)
  })

  test('WTB-002: width adjusts when workspace is added', async ({ window }) => {
    // Start with 2 workspaces
    const ws1Path = await workspaceHelpers.createTestWorkspace('adjust-ws-1', 1)
    const ws2Path = await workspaceHelpers.createTestWorkspace('adjust-ws-2', 1)

    await workspaceHelpers.addWorkspaceToApp(ws1Path)
    await workspaceHelpers.openFileInWorkspace(ws1Path, 'test-file-1.md')

    await workspaceHelpers.addWorkspaceToApp(ws2Path)
    await workspaceHelpers.openFileInWorkspace(ws2Path, 'test-file-1.md')

    await window.waitForTimeout(300)

    // Get initial widths (should be ~50% each)
    const initialGroups = await workspaceHelpers.getVisibleTabGroups()
    const initialWidth = initialGroups[0].width

    // Add a 3rd workspace
    const ws3Path = await workspaceHelpers.createTestWorkspace('adjust-ws-3', 1)
    await workspaceHelpers.addWorkspaceToApp(ws3Path)
    await workspaceHelpers.openFileInWorkspace(ws3Path, 'test-file-1.md')

    await window.waitForTimeout(300)

    // Get new widths (should be ~33% each)
    const finalGroups = await workspaceHelpers.getVisibleTabGroups()
    expect(finalGroups.length).toBe(3)

    const finalWidth = finalGroups[0].width

    // New width should be smaller (more workspaces sharing space)
    expect(finalWidth).toBeLessThan(initialWidth)

    // All widths should still be equal
    const widths = finalGroups.map(g => g.width)
    for (let i = 1; i < widths.length; i++) {
      expect(Math.abs(widths[0] - widths[i])).toBeLessThanOrEqual(2)
    }
  })
})
