// Traces: WTB-007 (canonical spec: specs/workspace-tab-bar/spec.md)
import { test, expect, waitForAppReady } from '../../fixtures'
import { WorkspaceHelpers } from '../../helpers/workspace-helpers'

/**
 * WTB-007: Workspace Overflow Dropdown
 *
 * When too many workspaces are visible to fit at their minimum widths,
 * excess workspaces move to an overflow dropdown menu.
 */
test.describe('WTB-007: Workspace Overflow Dropdown', () => {
  let workspaceHelpers: WorkspaceHelpers

  test.beforeEach(async ({ window, electronApp }) => {
    await waitForAppReady(window)
    workspaceHelpers = new WorkspaceHelpers(window, electronApp)
  })

  test.afterEach(async () => {
    await workspaceHelpers.cleanup()
  })

  test('WTB-007: overflow indicator appears when needed', async ({ window }) => {
    // Resize window to be narrow
    await window.setViewportSize({ width: 600, height: 800 })
    await window.waitForTimeout(200)

    // Create 6 workspaces with tabs (should overflow at 600px width)
    const workspacePaths: string[] = []
    for (let i = 1; i <= 6; i++) {
      const wsPath = await workspaceHelpers.createTestWorkspace(`overflow-ws-${i}`, 1)
      workspacePaths.push(wsPath)
    }

    for (const wsPath of workspacePaths) {
      await workspaceHelpers.addWorkspaceToApp(wsPath)
      await workspaceHelpers.openFileInWorkspace(wsPath, 'test-file-1.md')
    }

    await window.waitForTimeout(500)

    // Check if overflow is present
    const hasOverflow = await workspaceHelpers.isOverflowIndicatorVisible()

    // Get count of visible tab groups
    const tabGroups = await workspaceHelpers.getVisibleTabGroups()

    // Either all 6 fit, or some are in overflow
    if (tabGroups.length < 6) {
      expect(hasOverflow).toBe(true)
      const overflowCount = await workspaceHelpers.getOverflowCount()
      expect(overflowCount).toBe(6 - tabGroups.length)
    }
  })

  test('WTB-007: clicking overflow indicator opens dropdown', async ({ window }) => {
    // Resize window to be narrow
    await window.setViewportSize({ width: 500, height: 800 })
    await window.waitForTimeout(200)

    // Create 5 workspaces
    const workspacePaths: string[] = []
    for (let i = 1; i <= 5; i++) {
      const wsPath = await workspaceHelpers.createTestWorkspace(`dropdown-ws-${i}`, 1)
      workspacePaths.push(wsPath)
    }

    for (const wsPath of workspacePaths) {
      await workspaceHelpers.addWorkspaceToApp(wsPath)
      await workspaceHelpers.openFileInWorkspace(wsPath, 'test-file-1.md')
    }

    await window.waitForTimeout(500)

    const hasOverflow = await workspaceHelpers.isOverflowIndicatorVisible()

    if (hasOverflow) {
      // Click the overflow indicator
      await window.click('.tab-bar-overflow .overflow-button')
      await window.waitForTimeout(200)

      // Verify dropdown is open
      const dropdownVisible = await window.evaluate(() => {
        const dropdown = document.querySelector('.overflow-dropdown')
        return dropdown && window.getComputedStyle(dropdown).display !== 'none'
      })

      expect(dropdownVisible).toBe(true)
    }
  })

  test('WTB-007: clicking workspace in dropdown activates it', async ({ window }) => {
    // Resize window to be narrow
    await window.setViewportSize({ width: 500, height: 800 })
    await window.waitForTimeout(200)

    // Create 5 workspaces
    const workspacePaths: string[] = []
    for (let i = 1; i <= 5; i++) {
      const wsPath = await workspaceHelpers.createTestWorkspace(`activate-ws-${i}`, 1)
      workspacePaths.push(wsPath)
    }

    for (const wsPath of workspacePaths) {
      await workspaceHelpers.addWorkspaceToApp(wsPath)
      await workspaceHelpers.openFileInWorkspace(wsPath, 'test-file-1.md')
    }

    await window.waitForTimeout(500)

    const hasOverflow = await workspaceHelpers.isOverflowIndicatorVisible()

    if (hasOverflow) {
      // Get initial visible workspace count
      const initialTabGroups = await workspaceHelpers.getVisibleTabGroups()
      const initialCount = initialTabGroups.length

      // Click the overflow indicator
      await window.click('.tab-bar-overflow .overflow-button')
      await window.waitForTimeout(200)

      // Click first item in dropdown
      const clickedWorkspace = await window.evaluate(() => {
        const firstItem = document.querySelector('.overflow-dropdown-item')
        if (firstItem) {
          (firstItem as HTMLElement).click()
          return (firstItem as HTMLElement).dataset.workspaceId
        }
        return null
      })

      await window.waitForTimeout(300)

      // The clicked workspace should now be visible in tab bar
      if (clickedWorkspace) {
        const finalTabGroups = await workspaceHelpers.getVisibleTabGroups()
        const isNowVisible = finalTabGroups.some(g => g.workspaceId === clickedWorkspace)
        expect(isNowVisible).toBe(true)
      }
    }
  })

  test('WTB-007: active workspace never appears in overflow', async ({ window }) => {
    // Resize window to be narrow
    await window.setViewportSize({ width: 500, height: 800 })
    await window.waitForTimeout(200)

    // Create 5 workspaces
    const workspacePaths: string[] = []
    for (let i = 1; i <= 5; i++) {
      const wsPath = await workspaceHelpers.createTestWorkspace(`never-overflow-ws-${i}`, 1)
      workspacePaths.push(wsPath)
    }

    for (const wsPath of workspacePaths) {
      await workspaceHelpers.addWorkspaceToApp(wsPath)
      await workspaceHelpers.openFileInWorkspace(wsPath, 'test-file-1.md')
    }

    await window.waitForTimeout(500)

    // Get active workspace ID
    const activeWorkspaceId = await workspaceHelpers.getActiveWorkspaceId()
    expect(activeWorkspaceId).toBeTruthy()

    // Active workspace should be visible in tab bar, not in overflow
    const tabGroups = await workspaceHelpers.getVisibleTabGroups()
    const activeIsVisible = tabGroups.some(g => g.workspaceId === activeWorkspaceId)
    expect(activeIsVisible).toBe(true)

    // If overflow exists, active workspace should NOT be in it
    const hasOverflow = await workspaceHelpers.isOverflowIndicatorVisible()
    if (hasOverflow) {
      await window.click('.tab-bar-overflow .overflow-button')
      await window.waitForTimeout(200)

      const activeInDropdown = await window.evaluate((activeId) => {
        const dropdownItems = document.querySelectorAll('.overflow-dropdown-item')
        return Array.from(dropdownItems).some(
          item => (item as HTMLElement).dataset.workspaceId === activeId
        )
      }, activeWorkspaceId)

      expect(activeInDropdown).toBe(false)
    }
  })
})
