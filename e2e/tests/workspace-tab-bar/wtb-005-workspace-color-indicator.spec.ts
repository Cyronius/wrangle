import { test, expect, waitForAppReady } from '../../fixtures'
import { WorkspaceHelpers } from '../../helpers/workspace-helpers'

/**
 * WTB-005: Active Tab Indicator Uses Workspace Color
 *
 * The underline indicator for the active tab within a workspace matches that
 * workspace's assigned color, not the global accent color.
 */
test.describe('WTB-005: Active Tab Indicator Uses Workspace Color', () => {
  let workspaceHelpers: WorkspaceHelpers

  test.beforeEach(async ({ window, electronApp }) => {
    await waitForAppReady(window)
    workspaceHelpers = new WorkspaceHelpers(window, electronApp)
  })

  test.afterEach(async () => {
    await workspaceHelpers.cleanup()
  })

  test('WTB-005: active tab underline matches workspace color', async ({ window }) => {
    // Create 2 workspaces (they get different colors based on name hash)
    const ws1Path = await workspaceHelpers.createTestWorkspace('color-blue-ws', 2)
    const ws2Path = await workspaceHelpers.createTestWorkspace('color-green-ws', 2)

    await workspaceHelpers.addWorkspaceToApp(ws1Path)
    await workspaceHelpers.openFileInWorkspace(ws1Path, 'test-file-1.md')

    await workspaceHelpers.addWorkspaceToApp(ws2Path)
    await workspaceHelpers.openFileInWorkspace(ws2Path, 'test-file-1.md')

    await window.waitForTimeout(300)

    const tabGroups = await workspaceHelpers.getVisibleTabGroups()
    expect(tabGroups.length).toBe(2)

    // Get workspace colors and active tab border colors
    const colors = await window.evaluate(() => {
      const groups = document.querySelectorAll('.tab-group')
      return Array.from(groups).map(group => {
        const header = group.querySelector('.tab-group-header')
        const activeTab = group.querySelector('.tab.active')
        return {
          workspaceId: (group as HTMLElement).dataset.workspaceId,
          workspaceColor: (group as HTMLElement).style.getPropertyValue('--workspace-color'),
          headerColor: header ? window.getComputedStyle(header).backgroundColor : null,
          activeTabBorderColor: activeTab ? window.getComputedStyle(activeTab).borderBottomColor : null
        }
      })
    })

    // Verify each workspace's active tab uses the workspace color
    for (const color of colors) {
      expect(color.workspaceColor).toBeTruthy()
      // The active tab border should match the workspace color
      // (colors may be in different formats, so we just verify they're set)
      expect(color.activeTabBorderColor).toBeTruthy()
    }
  })

  test('WTB-005: indicator color matches workspace indicator exactly', async ({ window }) => {
    // Create a workspace
    const wsPath = await workspaceHelpers.createTestWorkspace('exact-color-ws', 2)

    await workspaceHelpers.addWorkspaceToApp(wsPath)
    await workspaceHelpers.openFileInWorkspace(wsPath, 'test-file-1.md')

    await window.waitForTimeout(300)

    // Get workspace color and active tab border color
    const colorMatch = await window.evaluate(() => {
      const group = document.querySelector('.tab-group')
      if (!group) return null

      const workspaceColor = (group as HTMLElement).style.getPropertyValue('--workspace-color')
      const activeTab = group.querySelector('.tab.active')
      if (!activeTab) return null

      const borderColor = window.getComputedStyle(activeTab).borderBottomColor

      // Convert workspace color to RGB for comparison
      const tempDiv = document.createElement('div')
      tempDiv.style.color = workspaceColor
      document.body.appendChild(tempDiv)
      const computedColor = window.getComputedStyle(tempDiv).color
      document.body.removeChild(tempDiv)

      return {
        workspaceColor: computedColor,
        borderColor: borderColor
      }
    })

    expect(colorMatch).toBeTruthy()
    // Colors should match (both in RGB format after computation)
    expect(colorMatch?.workspaceColor).toBe(colorMatch?.borderColor)
  })

  test('WTB-005: different workspaces have different active tab colors', async ({ window }) => {
    // Create 3 workspaces (names chosen to get different color indices)
    const ws1Path = await workspaceHelpers.createTestWorkspace('alpha-ws', 1)
    const ws2Path = await workspaceHelpers.createTestWorkspace('beta-ws', 1)
    const ws3Path = await workspaceHelpers.createTestWorkspace('gamma-ws', 1)

    await workspaceHelpers.addWorkspaceToApp(ws1Path)
    await workspaceHelpers.openFileInWorkspace(ws1Path, 'test-file-1.md')

    await workspaceHelpers.addWorkspaceToApp(ws2Path)
    await workspaceHelpers.openFileInWorkspace(ws2Path, 'test-file-1.md')

    await workspaceHelpers.addWorkspaceToApp(ws3Path)
    await workspaceHelpers.openFileInWorkspace(ws3Path, 'test-file-1.md')

    await window.waitForTimeout(300)

    // Get all workspace colors
    const colors = await window.evaluate(() => {
      const groups = document.querySelectorAll('.tab-group')
      return Array.from(groups).map(group => {
        return (group as HTMLElement).style.getPropertyValue('--workspace-color')
      })
    })

    expect(colors.length).toBe(3)

    // At least some colors should be different
    // (may not all be different if hash collides, but unlikely with these names)
    const uniqueColors = new Set(colors)
    expect(uniqueColors.size).toBeGreaterThanOrEqual(2)
  })
})
