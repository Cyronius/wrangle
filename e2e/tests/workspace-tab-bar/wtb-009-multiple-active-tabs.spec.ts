import { test, expect, waitForAppReady } from '../../fixtures'
import { WorkspaceHelpers } from '../../helpers/workspace-helpers'

/**
 * WTB-009: Multiple Active Tabs (One Per Workspace)
 *
 * Each workspace independently tracks its own active tab. The visual active
 * indicator shows on the active tab of EVERY visible workspace, not just
 * the currently focused workspace.
 */
test.describe('WTB-009: Multiple Active Tabs (One Per Workspace)', () => {
  let workspaceHelpers: WorkspaceHelpers

  test.beforeEach(async ({ window, electronApp }) => {
    await waitForAppReady(window)
    workspaceHelpers = new WorkspaceHelpers(window, electronApp)
  })

  test.afterEach(async () => {
    await workspaceHelpers.cleanup()
  })

  test('WTB-009: shows active indicator in ALL visible workspaces', async ({ window }) => {
    // Create 2 workspaces with multiple tabs each
    const ws1Path = await workspaceHelpers.createTestWorkspace('multi-active-1', 3)
    const ws2Path = await workspaceHelpers.createTestWorkspace('multi-active-2', 3)

    await workspaceHelpers.addWorkspaceToApp(ws1Path)
    await workspaceHelpers.openFileInWorkspace(ws1Path, 'test-file-1.md')
    await workspaceHelpers.openFileInWorkspace(ws1Path, 'test-file-2.md')
    await workspaceHelpers.openFileInWorkspace(ws1Path, 'test-file-3.md')

    await workspaceHelpers.addWorkspaceToApp(ws2Path)
    await workspaceHelpers.openFileInWorkspace(ws2Path, 'test-file-1.md')
    await workspaceHelpers.openFileInWorkspace(ws2Path, 'test-file-2.md')

    await window.waitForTimeout(500)

    // Get the count of active tabs across all visible workspaces
    const activeTabCount = await window.evaluate(() => {
      return document.querySelectorAll('.tab-group .tab.active').length
    })

    // Each workspace should have exactly one active tab
    expect(activeTabCount).toBe(2)
  })

  test('WTB-009: activating tab in one workspace does not affect others', async ({ window }) => {
    // Create 2 workspaces
    const ws1Path = await workspaceHelpers.createTestWorkspace('indep-ws-1', 3)
    const ws2Path = await workspaceHelpers.createTestWorkspace('indep-ws-2', 3)

    await workspaceHelpers.addWorkspaceToApp(ws1Path)
    await workspaceHelpers.openFileInWorkspace(ws1Path, 'test-file-1.md')
    await workspaceHelpers.openFileInWorkspace(ws1Path, 'test-file-2.md')
    await workspaceHelpers.openFileInWorkspace(ws1Path, 'test-file-3.md')

    await workspaceHelpers.addWorkspaceToApp(ws2Path)
    await workspaceHelpers.openFileInWorkspace(ws2Path, 'test-file-1.md')
    await workspaceHelpers.openFileInWorkspace(ws2Path, 'test-file-2.md')

    await window.waitForTimeout(500)

    const tabGroups = await workspaceHelpers.getVisibleTabGroups()
    const ws1Id = tabGroups.find(g => g.workspaceId.includes('indep-ws-1'))?.workspaceId
    const ws2Id = tabGroups.find(g => g.workspaceId.includes('indep-ws-2'))?.workspaceId

    // Get ws2's current active tab
    const ws2ActiveBefore = await window.evaluate((wsId) => {
      const group = document.querySelector(`.tab-group[data-workspace-id="${wsId}"]`)
      const activeTab = group?.querySelector('.tab.active')
      return activeTab ? (activeTab as HTMLElement).textContent : null
    }, ws2Id)

    // Click a different tab in ws1
    await window.click(`.tab-group[data-workspace-id="${ws1Id}"] .tab:first-child`)
    await window.waitForTimeout(200)

    // Check ws2's active tab is unchanged
    const ws2ActiveAfter = await window.evaluate((wsId) => {
      const group = document.querySelector(`.tab-group[data-workspace-id="${wsId}"]`)
      const activeTab = group?.querySelector('.tab.active')
      return activeTab ? (activeTab as HTMLElement).textContent : null
    }, ws2Id)

    expect(ws2ActiveAfter).toBe(ws2ActiveBefore)
  })

  test('WTB-009: switching workspaces shows correct document', async ({ window }) => {
    // Create 2 workspaces with different content
    const ws1Path = await workspaceHelpers.createTestWorkspace('content-ws-1', 2)
    const ws2Path = await workspaceHelpers.createTestWorkspace('content-ws-2', 2)

    await workspaceHelpers.addWorkspaceToApp(ws1Path)
    await workspaceHelpers.openFileInWorkspace(ws1Path, 'test-file-1.md')

    await workspaceHelpers.addWorkspaceToApp(ws2Path)
    await workspaceHelpers.openFileInWorkspace(ws2Path, 'test-file-1.md')

    await window.waitForTimeout(500)

    // ws2 is now active (last added)
    // Get editor content
    const getEditorContent = async () => {
      return window.evaluate(() => {
        const editor = document.querySelector('.monaco-editor .view-lines')
        return editor?.textContent || ''
      })
    }

    const ws2Content = await getEditorContent()

    // Switch to ws1
    await workspaceHelpers.clickWorkspaceInSidebar('content-ws-1')
    await window.waitForTimeout(300)

    const ws1Content = await getEditorContent()

    // Content should be different (different workspace files)
    // Both contain "Test File 1" but from different workspaces
    expect(ws1Content).toContain('content-ws-1')
    expect(ws2Content).toContain('content-ws-2')
  })

  test('WTB-009: previous workspace retains active tab indicator', async ({ window }) => {
    // Create 2 workspaces
    const ws1Path = await workspaceHelpers.createTestWorkspace('retain-ws-1', 3)
    const ws2Path = await workspaceHelpers.createTestWorkspace('retain-ws-2', 2)

    await workspaceHelpers.addWorkspaceToApp(ws1Path)
    await workspaceHelpers.openFileInWorkspace(ws1Path, 'test-file-1.md')
    await workspaceHelpers.openFileInWorkspace(ws1Path, 'test-file-2.md')
    await workspaceHelpers.openFileInWorkspace(ws1Path, 'test-file-3.md')

    await workspaceHelpers.addWorkspaceToApp(ws2Path)
    await workspaceHelpers.openFileInWorkspace(ws2Path, 'test-file-1.md')

    await window.waitForTimeout(500)

    const tabGroups = await workspaceHelpers.getVisibleTabGroups()
    const ws1Id = tabGroups.find(g => g.workspaceId.includes('retain-ws-1'))?.workspaceId

    // Click second tab in ws1 to make it active
    await window.click(`.tab-group[data-workspace-id="${ws1Id}"] .tab:nth-child(2)`)
    await window.waitForTimeout(200)

    // Verify ws1 has active tab on second position
    const ws1HasActive = await window.evaluate((wsId) => {
      const group = document.querySelector(`.tab-group[data-workspace-id="${wsId}"]`)
      const tabs = group?.querySelectorAll('.tab')
      return tabs && tabs.length >= 2 && tabs[1].classList.contains('active')
    }, ws1Id)
    expect(ws1HasActive).toBe(true)

    // Switch to ws2
    await workspaceHelpers.clickWorkspaceInSidebar('retain-ws-2')
    await window.waitForTimeout(200)

    // Verify ws1 STILL has active indicator on second tab
    const ws1StillHasActive = await window.evaluate((wsId) => {
      const group = document.querySelector(`.tab-group[data-workspace-id="${wsId}"]`)
      const tabs = group?.querySelectorAll('.tab')
      return tabs && tabs.length >= 2 && tabs[1].classList.contains('active')
    }, ws1Id)
    expect(ws1StillHasActive).toBe(true)
  })

  test('WTB-009: each workspace shows one and only one active tab', async ({ window }) => {
    // Create 3 workspaces
    const ws1Path = await workspaceHelpers.createTestWorkspace('single-active-1', 4)
    const ws2Path = await workspaceHelpers.createTestWorkspace('single-active-2', 3)
    const ws3Path = await workspaceHelpers.createTestWorkspace('single-active-3', 2)

    await workspaceHelpers.addWorkspaceToApp(ws1Path)
    for (let i = 1; i <= 4; i++) {
      await workspaceHelpers.openFileInWorkspace(ws1Path, `test-file-${i}.md`)
    }

    await workspaceHelpers.addWorkspaceToApp(ws2Path)
    for (let i = 1; i <= 3; i++) {
      await workspaceHelpers.openFileInWorkspace(ws2Path, `test-file-${i}.md`)
    }

    await workspaceHelpers.addWorkspaceToApp(ws3Path)
    for (let i = 1; i <= 2; i++) {
      await workspaceHelpers.openFileInWorkspace(ws3Path, `test-file-${i}.md`)
    }

    await window.waitForTimeout(500)

    // Count active tabs per workspace
    const activeTabsPerWorkspace = await window.evaluate(() => {
      const groups = document.querySelectorAll('.tab-group')
      return Array.from(groups).map(group => {
        const activeTabs = group.querySelectorAll('.tab.active')
        return {
          workspaceId: (group as HTMLElement).dataset.workspaceId,
          activeCount: activeTabs.length
        }
      })
    })

    // Each workspace should have exactly 1 active tab
    for (const ws of activeTabsPerWorkspace) {
      expect(ws.activeCount).toBe(1)
    }
  })
})
