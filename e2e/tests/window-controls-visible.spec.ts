import { test, expect } from '../fixtures'
import { WorkspaceHelpers } from '../helpers/workspace-helpers'

/**
 * Test that window controls (minimize/maximize/close) remain visible
 * even when the window is narrow and many workspace tabs are present.
 */
test.describe('Window controls visibility at small window sizes', () => {
  /**
   * Helper: assert all 3 window control buttons are within the viewport.
   */
  async function expectControlsVisible(page: import('@playwright/test').Page) {
    const result = await page.evaluate(() => {
      const controls = document.querySelector('.window-controls')
      if (!controls) return { found: false as const }

      const rect = controls.getBoundingClientRect()
      const vpWidth = window.innerWidth
      const buttons = controls.querySelectorAll('.window-control-btn')
      const allInView = Array.from(buttons).every((btn) => {
        const r = btn.getBoundingClientRect()
        return r.right <= vpWidth + 1 && r.left >= 0
      })

      return {
        found: true as const,
        buttonCount: buttons.length,
        allInView,
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        vpWidth
      }
    })

    expect(result.found, 'Window controls element must exist').toBe(true)
    if (!result.found) return
    expect(result.buttonCount, 'Should have 3 window control buttons').toBe(3)
    expect(
      result.allInView,
      `All buttons must be within viewport (${result.vpWidth}px). Controls: left=${result.left}, right=${result.right}`
    ).toBe(true)
  }

  test('multi-pane: controls visible at 600px with 5 workspaces', async ({
    electronApp,
    window
  }) => {
    const workspaceHelpers = new WorkspaceHelpers(window, electronApp)
    try {
      await window.waitForSelector('.tab-row', { timeout: 10000 })

      for (const name of ['alpha', 'bravo', 'charlie', 'delta', 'echo']) {
        const wsPath = await workspaceHelpers.createTestWorkspace(name, 1)
        await workspaceHelpers.addWorkspaceToApp(wsPath)
        await workspaceHelpers.openFileInWorkspace(wsPath, 'test-file-1.md')
      }
      await window.waitForTimeout(500)

      await electronApp.evaluate(({ BrowserWindow }) => {
        BrowserWindow.getAllWindows()[0].setSize(600, 400)
      })
      await window.waitForTimeout(500)

      await expectControlsVisible(window)
    } finally {
      await workspaceHelpers.cleanup()
    }
  })

  test('multi-pane: controls visible at 400px with 4 workspaces', async ({
    electronApp,
    window
  }) => {
    const workspaceHelpers = new WorkspaceHelpers(window, electronApp)
    try {
      await window.waitForSelector('.tab-row', { timeout: 10000 })

      for (const name of ['ws1', 'ws2', 'ws3', 'ws4']) {
        const wsPath = await workspaceHelpers.createTestWorkspace(name, 2)
        await workspaceHelpers.addWorkspaceToApp(wsPath)
        await workspaceHelpers.openFileInWorkspace(wsPath, 'test-file-1.md')
        await workspaceHelpers.openFileInWorkspace(wsPath, 'test-file-2.md')
      }
      await window.waitForTimeout(500)

      await electronApp.evaluate(({ BrowserWindow }) => {
        BrowserWindow.getAllWindows()[0].setSize(400, 400)
      })
      await window.waitForTimeout(500)

      await expectControlsVisible(window)
    } finally {
      await workspaceHelpers.cleanup()
    }
  })

  test('single-pane: controls visible at 500px with many tabs', async ({
    electronApp,
    window
  }) => {
    const workspaceHelpers = new WorkspaceHelpers(window, electronApp)
    try {
      await window.waitForSelector('.tab-row', { timeout: 10000 })

      const wsPath = await workspaceHelpers.createTestWorkspace('single', 8)
      await workspaceHelpers.addWorkspaceToApp(wsPath)
      for (let i = 1; i <= 8; i++) {
        await workspaceHelpers.openFileInWorkspace(wsPath, `test-file-${i}.md`)
      }
      await window.waitForTimeout(500)

      await electronApp.evaluate(({ BrowserWindow }) => {
        BrowserWindow.getAllWindows()[0].setSize(500, 400)
      })
      await window.waitForTimeout(500)

      await expectControlsVisible(window)
    } finally {
      await workspaceHelpers.cleanup()
    }
  })
})
