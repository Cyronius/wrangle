// Traces: WTB-001 (canonical spec: specs/workspace-tab-bar/spec.md)
import { test, expect, waitForAppReady } from '../../fixtures'
import { WorkspaceHelpers } from '../../helpers/workspace-helpers'

/**
 * WTB-001: Workspace Browse + Show on Single Click
 *
 * A single click on a workspace in the WorkspaceBar browses it (shows its file
 * tree in the sidebar, makes it active) AND shows it in the editor as a pane
 * (`visibleInTabBar = true`). Clicking a hidden workspace re-shows it; clicking
 * an already-visible workspace is idempotent.
 */
test.describe('WTB-001: Workspace Browse + Show on Single Click', () => {
  let h: WorkspaceHelpers
  let ws1Id: string
  let ws2Id: string
  let ws3Id: string

  test.beforeEach(async ({ window, electronApp }) => {
    await waitForAppReady(window)
    h = new WorkspaceHelpers(window, electronApp)
    await h.resetAppState()

    const p1 = await h.createTestWorkspace('test-ws-1', 2)
    const p2 = await h.createTestWorkspace('test-ws-2', 2)
    const p3 = await h.createTestWorkspace('test-ws-3', 2)
    ws1Id = h.getWorkspaceId(p1)
    ws2Id = h.getWorkspaceId(p2)
    ws3Id = h.getWorkspaceId(p3)

    await h.addWorkspaceToApp(p1)
    await h.openFileInWorkspace(p1, 'test-file-1.md')
    await h.addWorkspaceToApp(p2)
    await h.openFileInWorkspace(p2, 'test-file-1.md')
    await h.addWorkspaceToApp(p3)
    await h.openFileInWorkspace(p3, 'test-file-1.md')

    await window.waitForTimeout(300)
  })

  test.afterEach(async () => {
    await h.cleanup()
  })

  test('WTB-001: all three workspaces are in the editor by default', async () => {
    const vis = await h.getWorkspaceVisibility()
    expect(vis[ws1Id]).toBe(true)
    expect(vis[ws2Id]).toBe(true)
    expect(vis[ws3Id]).toBe(true)
    expect(await h.getEditorWorkspaceCount()).toBe(3)
  })

  test('WTB-001: clicking a hidden workspace re-shows it as a pane', async ({ window }) => {
    // Hide ws-1 first (explorer header button), then click it to bring it back.
    await h.hideWorkspaceFromHeader('test-ws-1')
    await window.waitForTimeout(150)
    expect((await h.getWorkspaceVisibility())[ws1Id]).toBe(false)
    const hiddenCount = await h.getEditorWorkspaceCount()

    await h.clickWorkspaceInSidebar('test-ws-1')
    await window.waitForTimeout(200)

    expect((await h.getWorkspaceVisibility())[ws1Id]).toBe(true)
    expect(await h.getEditorWorkspaceCount()).toBe(hiddenCount + 1)
    expect(await h.isRailItemDimmed('test-ws-1')).toBe(false)
  })

  test('WTB-001: single click makes the clicked workspace active', async ({ window }) => {
    await h.clickWorkspaceInSidebar('test-ws-1')
    await window.waitForTimeout(200)
    expect(await h.getActiveWorkspaceId()).toBe(ws1Id)
  })

  test('WTB-001: clicking the active visible workspace hides it (toggle off)', async ({ window }) => {
    // First click makes ws-1 the active, visible workspace.
    await h.clickWorkspaceInSidebar('test-ws-1')
    await window.waitForTimeout(150)
    expect(await h.getActiveWorkspaceId()).toBe(ws1Id)
    expect((await h.getWorkspaceVisibility())[ws1Id]).toBe(true)
    const before = await h.getEditorWorkspaceCount()

    // Clicking the already-active, visible workspace hides it.
    await h.clickWorkspaceInSidebar('test-ws-1')
    await window.waitForTimeout(200)

    expect((await h.getWorkspaceVisibility())[ws1Id]).toBe(false)
    expect(await h.getEditorWorkspaceCount()).toBe(before - 1)
    expect(await h.isRailItemDimmed('test-ws-1')).toBe(true)
  })

  test('WTB-001: clicking the active hidden workspace re-shows it (toggle on)', async ({ window }) => {
    await h.clickWorkspaceInSidebar('test-ws-1') // activate + show
    await window.waitForTimeout(150)
    await h.clickWorkspaceInSidebar('test-ws-1') // toggle off (hide)
    await window.waitForTimeout(150)
    expect((await h.getWorkspaceVisibility())[ws1Id]).toBe(false)

    await h.clickWorkspaceInSidebar('test-ws-1') // toggle on (re-show)
    await window.waitForTimeout(200)
    expect((await h.getWorkspaceVisibility())[ws1Id]).toBe(true)
    expect(await h.isRailItemDimmed('test-ws-1')).toBe(false)
  })
})
