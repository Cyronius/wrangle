// Traces: WTB-013 (canonical spec: specs/workspace-tab-bar/spec.md)
import { test, expect, waitForAppReady } from '../../fixtures'
import { WorkspaceHelpers } from '../../helpers/workspace-helpers'

/**
 * WTB-013: Hide Workspace From Editor
 *
 * A workspace is removed from the editor (visibleInTabBar = false) while staying
 * open via two affordances: the explorer header hide button (eye-off, not ×), and
 * clicking the already-active, visible workspace in the rail (the WTB-001 toggle).
 * Both are no-ops for the last remaining visible workspace.
 */
test.describe('WTB-013: Hide Workspace From Editor', () => {
  let h: WorkspaceHelpers
  let ws1Id: string
  let ws2Id: string

  test.beforeEach(async ({ window, electronApp }) => {
    await waitForAppReady(window)
    h = new WorkspaceHelpers(window, electronApp)
    await h.resetAppState()

    const p1 = await h.createTestWorkspace('test-ws-1', 2)
    const p2 = await h.createTestWorkspace('test-ws-2', 2)
    ws1Id = h.getWorkspaceId(p1)
    ws2Id = h.getWorkspaceId(p2)

    await h.addWorkspaceToApp(p1)
    await h.openFileInWorkspace(p1, 'test-file-1.md')
    await h.addWorkspaceToApp(p2)
    await h.openFileInWorkspace(p2, 'test-file-1.md')

    await window.waitForTimeout(300)
  })

  test.afterEach(async () => {
    await h.cleanup()
  })

  test('WTB-013: explorer header hide button removes the pane from the editor', async ({ window }) => {
    const before = await h.getEditorWorkspaceCount()
    expect((await h.getWorkspaceVisibility())[ws1Id]).toBe(true)

    await h.hideWorkspaceFromHeader('test-ws-1')
    await window.waitForTimeout(200)

    expect((await h.getWorkspaceVisibility())[ws1Id]).toBe(false)
    expect(await h.getEditorWorkspaceCount()).toBe(before - 1)
    expect(await h.isRailItemDimmed('test-ws-1')).toBe(true)
  })

  test('WTB-013: hiding does not change the active/browsed workspace', async ({ window }) => {
    await h.hideWorkspaceFromHeader('test-ws-1')
    await window.waitForTimeout(200)
    // hideWorkspaceFromHeader activates ws-1 before hiding; it stays active.
    expect(await h.getActiveWorkspaceId()).toBe(ws1Id)
  })

  test('WTB-013: rail click-to-hide toggles the active visible workspace', async ({ window }) => {
    await h.clickWorkspaceInSidebar('test-ws-1') // activate + show
    await window.waitForTimeout(150)
    expect((await h.getWorkspaceVisibility())[ws1Id]).toBe(true)

    await h.clickWorkspaceInSidebar('test-ws-1') // click again hides it
    await window.waitForTimeout(200)

    expect((await h.getWorkspaceVisibility())[ws1Id]).toBe(false)
    expect(await h.isRailItemDimmed('test-ws-1')).toBe(true)
  })

  test('WTB-013: clicking a hidden workspace re-shows it', async ({ window }) => {
    await h.hideWorkspaceFromHeader('test-ws-1')
    await window.waitForTimeout(150)
    expect((await h.getWorkspaceVisibility())[ws1Id]).toBe(false)

    await h.clickWorkspaceInSidebar('test-ws-1')
    await window.waitForTimeout(200)

    expect((await h.getWorkspaceVisibility())[ws1Id]).toBe(true)
    expect(await h.isRailItemDimmed('test-ws-1')).toBe(false)
  })

  test('WTB-013: cannot hide the last visible workspace (header disabled, rail no-op)', async ({ window }) => {
    // Collapse to a single visible workspace (ws-2): hide Default and ws-1.
    await h.hideWorkspaceFromHeader('Default')
    await window.waitForTimeout(100)
    await h.hideWorkspaceFromHeader('test-ws-1')
    await window.waitForTimeout(100)

    const vis = await h.getWorkspaceVisibility()
    expect(vis[ws2Id]).toBe(true)
    expect(Object.values(vis).filter(Boolean).length).toBe(1)

    // Header hide button is disabled for the last visible workspace.
    await h.clickWorkspaceInSidebar('test-ws-2')
    await window.waitForTimeout(150)
    expect(await h.isHeaderHideDisabled()).toBe(true)

    // Rail click-to-hide on the last visible workspace is a no-op.
    await h.clickWorkspaceInSidebar('test-ws-2')
    await window.waitForTimeout(150)
    expect((await h.getWorkspaceVisibility())[ws2Id]).toBe(true)
  })
})
