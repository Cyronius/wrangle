// Traces: WTB-004 (canonical spec: specs/workspace-tab-bar/spec.md)
import { test, expect, waitForAppReady } from '../../fixtures'
import { WorkspaceHelpers } from '../../helpers/workspace-helpers'

/**
 * WTB-004: Fixed Workspace Indicator
 *
 * The workspace's colored indicator bar remains fixed (pinned) at the left edge
 * of its allocated space while tabs scroll.
 */
test.describe('WTB-004: Fixed Workspace Indicator', () => {
  let workspaceHelpers: WorkspaceHelpers

  test.beforeEach(async ({ window, electronApp }) => {
    await waitForAppReady(window)
    workspaceHelpers = new WorkspaceHelpers(window, electronApp)
  })

  test.afterEach(async () => {
    await workspaceHelpers.cleanup()
  })

  test('WTB-004: workspace indicator stays visible when tabs scroll', async ({ window }) => {
    // Create a workspace with 15+ tabs (enough to scroll)
    const wsPath = await workspaceHelpers.createTestWorkspace('indicator-ws', 15)

    await workspaceHelpers.addWorkspaceToApp(wsPath)
    for (let i = 1; i <= 15; i++) {
      await workspaceHelpers.openFileInWorkspace(wsPath, `test-file-${i}.md`)
    }

    await window.waitForTimeout(500)

    const tabGroups = await workspaceHelpers.getVisibleTabGroups()
    expect(tabGroups.length).toBe(1)
    const wsId = tabGroups[0].workspaceId

    // Get initial header position
    const getHeaderPosition = async () => {
      return window.evaluate((workspaceId) => {
        const group = document.querySelector(`.tab-group[data-workspace-id="${workspaceId}"]`)
        const header = group?.querySelector('.tab-group-header')
        if (!header) return null
        const rect = header.getBoundingClientRect()
        const groupRect = group!.getBoundingClientRect()
        return {
          left: rect.left,
          groupLeft: groupRect.left,
          visible: rect.width > 0 && rect.height > 0
        }
      }, wsId)
    }

    const initialPos = await getHeaderPosition()
    expect(initialPos?.visible).toBe(true)

    // Scroll the tabs fully to the right
    await workspaceHelpers.scrollTabGroup(wsId, 1000)
    await window.waitForTimeout(200)

    // Get header position after scrolling
    const afterScrollPos = await getHeaderPosition()
    expect(afterScrollPos?.visible).toBe(true)

    // Header should still be at the left edge of the group
    // (within 5px tolerance for any borders/padding)
    expect(Math.abs((afterScrollPos?.left || 0) - (afterScrollPos?.groupLeft || 0))).toBeLessThanOrEqual(5)
  })

  test('WTB-004: indicator position unchanged after scroll', async ({ window }) => {
    // Create workspace with many tabs
    const wsPath = await workspaceHelpers.createTestWorkspace('fixed-header-ws', 20)

    await workspaceHelpers.addWorkspaceToApp(wsPath)
    for (let i = 1; i <= 20; i++) {
      await workspaceHelpers.openFileInWorkspace(wsPath, `test-file-${i}.md`)
    }

    await window.waitForTimeout(500)

    const tabGroups = await workspaceHelpers.getVisibleTabGroups()
    const wsId = tabGroups[0].workspaceId

    // Get header's left position before scroll
    const getHeaderLeft = async () => {
      return window.evaluate((workspaceId) => {
        const group = document.querySelector(`.tab-group[data-workspace-id="${workspaceId}"]`)
        const header = group?.querySelector('.tab-group-header')
        return header?.getBoundingClientRect().left || 0
      }, wsId)
    }

    const beforeScrollLeft = await getHeaderLeft()

    // Scroll tabs
    await workspaceHelpers.scrollTabGroup(wsId, 500)
    await window.waitForTimeout(200)

    const afterScrollLeft = await getHeaderLeft()

    // Header should be in the same horizontal position
    expect(afterScrollLeft).toBe(beforeScrollLeft)
  })

  test('WTB-004: clicking indicator activates workspace', async ({ window }) => {
    // Create 2 workspaces
    const ws1Path = await workspaceHelpers.createTestWorkspace('click-ws-1', 2)
    const ws2Path = await workspaceHelpers.createTestWorkspace('click-ws-2', 2)

    await workspaceHelpers.addWorkspaceToApp(ws1Path)
    await workspaceHelpers.openFileInWorkspace(ws1Path, 'test-file-1.md')

    await workspaceHelpers.addWorkspaceToApp(ws2Path)
    await workspaceHelpers.openFileInWorkspace(ws2Path, 'test-file-1.md')

    await window.waitForTimeout(300)

    // ws2 should be active (last added)
    const tabGroups = await workspaceHelpers.getVisibleTabGroups()
    expect(tabGroups.length).toBe(2)

    // Find ws1's header and click it
    const ws1Id = tabGroups.find(g => g.workspaceId.includes('click-ws-1'))?.workspaceId
    expect(ws1Id).toBeTruthy()

    await window.click(`.tab-group[data-workspace-id="${ws1Id}"] .tab-group-header`)
    await window.waitForTimeout(200)

    // Verify workspace 1 is now active
    const activeWorkspaceId = await workspaceHelpers.getActiveWorkspaceId()
    expect(activeWorkspaceId).toBe(ws1Id)
  })
})
