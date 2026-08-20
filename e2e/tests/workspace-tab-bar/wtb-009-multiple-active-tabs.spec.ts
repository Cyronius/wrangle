// Traces: WTB-009, WTB-014 (canonical spec: specs/workspace-tab-bar/spec.md)
import { test, expect, waitForAppReady } from '../../fixtures'
import { WorkspaceHelpers } from '../../helpers/workspace-helpers'

/**
 * WTB-009: Per-workspace active tab memory.
 * WTB-014: The tab bar renders only the active workspace's tabs; activating
 * another workspace swaps the visible tab set and restores its last-active tab.
 */
test.describe('WTB-009/WTB-014: active-workspace tab bar with per-workspace memory', () => {
  let workspaceHelpers: WorkspaceHelpers

  test.beforeEach(async ({ window, electronApp }) => {
    await waitForAppReady(window)
    workspaceHelpers = new WorkspaceHelpers(window, electronApp)
  })

  test.afterEach(async () => {
    await workspaceHelpers.cleanup()
  })

  test('WTB-014: only the active workspace renders a tab group', async ({ window }) => {
    const ws1Path = await workspaceHelpers.createTestWorkspace('active-only-1', 3)
    const ws2Path = await workspaceHelpers.createTestWorkspace('active-only-2', 2)

    await workspaceHelpers.addWorkspaceToApp(ws1Path)
    await workspaceHelpers.openFileInWorkspace(ws1Path, 'test-file-1.md')
    await workspaceHelpers.openFileInWorkspace(ws1Path, 'test-file-2.md')

    await workspaceHelpers.addWorkspaceToApp(ws2Path)
    await workspaceHelpers.openFileInWorkspace(ws2Path, 'test-file-1.md')

    await window.waitForTimeout(500)

    // ws2 is active (last added): exactly one tab group, with ws2's id
    const groups = await workspaceHelpers.getVisibleTabGroups()
    expect(groups).toHaveLength(1)
    expect(groups[0].workspaceId).toBe(workspaceHelpers.getWorkspaceId(ws2Path))

    // Exactly one active tab is rendered overall
    const activeTabCount = await window.evaluate(
      () => document.querySelectorAll('.tab-group .tab.active').length
    )
    expect(activeTabCount).toBe(1)
  })

  test('WTB-014: activating another workspace swaps the tab bar', async ({ window }) => {
    const ws1Path = await workspaceHelpers.createTestWorkspace('swap-ws-1', 2)
    const ws2Path = await workspaceHelpers.createTestWorkspace('swap-ws-2', 1)

    await workspaceHelpers.addWorkspaceToApp(ws1Path)
    await workspaceHelpers.openFileInWorkspace(ws1Path, 'test-file-1.md')
    await workspaceHelpers.openFileInWorkspace(ws1Path, 'test-file-2.md')

    await workspaceHelpers.addWorkspaceToApp(ws2Path)
    await workspaceHelpers.openFileInWorkspace(ws2Path, 'test-file-1.md')
    await window.waitForTimeout(500)

    // Activate ws1 via its sidebar section (SBR-004)
    await workspaceHelpers.clickWorkspaceInSidebar('swap-ws-1')
    await window.waitForTimeout(300)

    const groups = await workspaceHelpers.getVisibleTabGroups()
    expect(groups).toHaveLength(1)
    expect(groups[0].workspaceId).toBe(workspaceHelpers.getWorkspaceId(ws1Path))

    const tabCount = await window.evaluate(
      () => document.querySelectorAll('.tab-bar .tab').length
    )
    expect(tabCount).toBe(2)
  })

  test('WTB-009: each workspace remembers its own active tab across switches', async ({ window }) => {
    const ws1Path = await workspaceHelpers.createTestWorkspace('retain-ws-1', 3)
    const ws2Path = await workspaceHelpers.createTestWorkspace('retain-ws-2', 2)

    await workspaceHelpers.addWorkspaceToApp(ws1Path)
    await workspaceHelpers.openFileInWorkspace(ws1Path, 'test-file-1.md')
    await workspaceHelpers.openFileInWorkspace(ws1Path, 'test-file-2.md')
    await workspaceHelpers.openFileInWorkspace(ws1Path, 'test-file-3.md')

    await workspaceHelpers.addWorkspaceToApp(ws2Path)
    await workspaceHelpers.openFileInWorkspace(ws2Path, 'test-file-1.md')
    await window.waitForTimeout(500)

    // Activate ws1 and pick its second tab
    await workspaceHelpers.clickWorkspaceInSidebar('retain-ws-1')
    await window.waitForTimeout(300)
    await window.click('.tab-bar .tab:nth-child(2), .tab-bar .sortable-tab-wrapper:nth-child(2) .tab')
    await window.waitForTimeout(200)

    const activeLabel = async () =>
      window.evaluate(() => document.querySelector('.tab.active .tab-label')?.textContent ?? null)
    const ws1Choice = await activeLabel()

    // Switch away and back
    await workspaceHelpers.clickWorkspaceInSidebar('retain-ws-2')
    await window.waitForTimeout(300)
    await workspaceHelpers.clickWorkspaceInSidebar('retain-ws-1')
    await window.waitForTimeout(300)

    // ws1's remembered tab is active again
    expect(await activeLabel()).toBe(ws1Choice)
  })

  test('WTB-009: switching workspaces shows the correct document', async ({ window }) => {
    const ws1Path = await workspaceHelpers.createTestWorkspace('content-ws-1', 2)
    const ws2Path = await workspaceHelpers.createTestWorkspace('content-ws-2', 2)

    await workspaceHelpers.addWorkspaceToApp(ws1Path)
    await workspaceHelpers.openFileInWorkspace(ws1Path, 'test-file-1.md')

    await workspaceHelpers.addWorkspaceToApp(ws2Path)
    await workspaceHelpers.openFileInWorkspace(ws2Path, 'test-file-1.md')
    await window.waitForTimeout(500)

    const getEditorContent = async () =>
      window.evaluate(() => document.querySelector('.monaco-editor .view-lines')?.textContent || '')

    const ws2Content = await getEditorContent()

    await workspaceHelpers.clickWorkspaceInSidebar('content-ws-1')
    await window.waitForTimeout(300)
    const ws1Content = await getEditorContent()

    expect(ws1Content).toContain('content-ws-1')
    expect(ws2Content).toContain('content-ws-2')
  })
})
