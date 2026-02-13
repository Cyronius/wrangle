import { test, expect, waitForAppReady } from '../../fixtures'
import { WorkspaceHelpers } from '../../helpers/workspace-helpers'

/**
 * WTB-003: Independent Horizontal Scrolling Per Workspace
 *
 * Each workspace's tab group scrolls horizontally independently when its tabs
 * exceed the allocated width.
 */
test.describe('WTB-003: Independent Horizontal Scrolling Per Workspace', () => {
  let workspaceHelpers: WorkspaceHelpers

  test.beforeEach(async ({ window, electronApp }) => {
    await waitForAppReady(window)
    workspaceHelpers = new WorkspaceHelpers(window, electronApp)
  })

  test.afterEach(async () => {
    await workspaceHelpers.cleanup()
  })

  test('WTB-003: workspace with many tabs shows scrollbar', async ({ window }) => {
    // Create workspace with many tabs (enough to overflow)
    const wsPath = await workspaceHelpers.createTestWorkspace('scroll-ws', 20)

    await workspaceHelpers.addWorkspaceToApp(wsPath)

    // Open all 20 files
    for (let i = 1; i <= 20; i++) {
      await workspaceHelpers.openFileInWorkspace(wsPath, `test-file-${i}.md`)
    }

    await window.waitForTimeout(500)

    // Get workspace ID from tab groups
    const tabGroups = await workspaceHelpers.getVisibleTabGroups()
    expect(tabGroups.length).toBe(1)

    // Check if workspace has scrollbar
    const hasScrollbar = await workspaceHelpers.hasHorizontalScrollbar(tabGroups[0].workspaceId)
    expect(hasScrollbar).toBe(true)
  })

  test('WTB-003: workspace with few tabs does not show scrollbar', async ({ window }) => {
    // Create workspace with just 2 tabs
    const wsPath = await workspaceHelpers.createTestWorkspace('no-scroll-ws', 2)

    await workspaceHelpers.addWorkspaceToApp(wsPath)
    await workspaceHelpers.openFileInWorkspace(wsPath, 'test-file-1.md')
    await workspaceHelpers.openFileInWorkspace(wsPath, 'test-file-2.md')

    await window.waitForTimeout(300)

    const tabGroups = await workspaceHelpers.getVisibleTabGroups()
    expect(tabGroups.length).toBe(1)

    // Should not have scrollbar with only 2 tabs
    const hasScrollbar = await workspaceHelpers.hasHorizontalScrollbar(tabGroups[0].workspaceId)
    expect(hasScrollbar).toBe(false)
  })

  test('WTB-003: scrolling one workspace does not affect others', async ({ window }) => {
    // Create 2 workspaces, one with many tabs
    const ws1Path = await workspaceHelpers.createTestWorkspace('many-scroll', 15)
    const ws2Path = await workspaceHelpers.createTestWorkspace('few-scroll', 3)

    await workspaceHelpers.addWorkspaceToApp(ws1Path)
    for (let i = 1; i <= 15; i++) {
      await workspaceHelpers.openFileInWorkspace(ws1Path, `test-file-${i}.md`)
    }

    await workspaceHelpers.addWorkspaceToApp(ws2Path)
    await workspaceHelpers.openFileInWorkspace(ws2Path, 'test-file-1.md')
    await workspaceHelpers.openFileInWorkspace(ws2Path, 'test-file-2.md')
    await workspaceHelpers.openFileInWorkspace(ws2Path, 'test-file-3.md')

    await window.waitForTimeout(500)

    const tabGroups = await workspaceHelpers.getVisibleTabGroups()
    expect(tabGroups.length).toBe(2)

    const ws1Id = tabGroups.find(g => g.workspaceId.includes('many-scroll'))?.workspaceId
    const ws2Id = tabGroups.find(g => g.workspaceId.includes('few-scroll'))?.workspaceId

    expect(ws1Id).toBeTruthy()
    expect(ws2Id).toBeTruthy()

    // Get initial scroll positions
    const initialScroll1 = await workspaceHelpers.getScrollPosition(ws1Id!)
    const initialScroll2 = await workspaceHelpers.getScrollPosition(ws2Id!)

    // Scroll workspace 1
    await workspaceHelpers.scrollTabGroup(ws1Id!, 200)

    await window.waitForTimeout(200)

    // Check scroll positions
    const afterScroll1 = await workspaceHelpers.getScrollPosition(ws1Id!)
    const afterScroll2 = await workspaceHelpers.getScrollPosition(ws2Id!)

    // Workspace 1 should have scrolled
    expect(afterScroll1).toBeGreaterThan(initialScroll1)

    // Workspace 2 should NOT have scrolled
    expect(afterScroll2).toBe(initialScroll2)
  })

  test('WTB-003: scroll position is preserved when switching workspaces', async ({ window }) => {
    // Create 2 workspaces with many tabs
    const ws1Path = await workspaceHelpers.createTestWorkspace('preserve-scroll-1', 15)
    const ws2Path = await workspaceHelpers.createTestWorkspace('preserve-scroll-2', 5)

    await workspaceHelpers.addWorkspaceToApp(ws1Path)
    for (let i = 1; i <= 15; i++) {
      await workspaceHelpers.openFileInWorkspace(ws1Path, `test-file-${i}.md`)
    }

    await workspaceHelpers.addWorkspaceToApp(ws2Path)
    await workspaceHelpers.openFileInWorkspace(ws2Path, 'test-file-1.md')

    await window.waitForTimeout(500)

    const tabGroups = await workspaceHelpers.getVisibleTabGroups()
    const ws1Id = tabGroups.find(g => g.workspaceId.includes('preserve-scroll-1'))?.workspaceId

    expect(ws1Id).toBeTruthy()

    // Scroll workspace 1
    await workspaceHelpers.scrollTabGroup(ws1Id!, 300)
    await window.waitForTimeout(200)

    const scrollAfterScroll = await workspaceHelpers.getScrollPosition(ws1Id!)
    expect(scrollAfterScroll).toBeGreaterThan(0)

    // Click on workspace 2 to switch
    await workspaceHelpers.clickWorkspaceInSidebar('preserve-scroll-2')
    await window.waitForTimeout(200)

    // Click back on workspace 1
    await workspaceHelpers.clickWorkspaceInSidebar('preserve-scroll-1')
    await window.waitForTimeout(200)

    // Scroll position should be preserved
    const scrollAfterSwitch = await workspaceHelpers.getScrollPosition(ws1Id!)
    expect(scrollAfterSwitch).toBe(scrollAfterScroll)
  })

  test('WTB-003: tab bar itself does not scroll', async ({ window }) => {
    // Verify the main tab bar container has overflow: hidden
    const tabBarOverflow = await window.evaluate(() => {
      const tabBar = document.querySelector('.tab-bar')
      if (!tabBar) return null
      return window.getComputedStyle(tabBar).overflow
    })

    expect(tabBarOverflow).toBe('hidden')
  })
})
