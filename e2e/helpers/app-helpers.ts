import { Page, ElectronApplication } from '@playwright/test'
import { waitForAppReady } from '../fixtures/test-utils'

/**
 * Helper class for common app operations
 */
export class AppHelpers {
  constructor(
    private page: Page,
    private electronApp: ElectronApplication
  ) {}

  /**
   * Wait for the app to be fully loaded and ready
   */
  async waitUntilReady(timeout = 30000): Promise<void> {
    await waitForAppReady(this.page, timeout)
  }

  /**
   * Get the current view mode (editor-only, split, preview-only)
   */
  async getViewMode(): Promise<string> {
    return this.page.evaluate(() => {
      // Check for allotment (split view)
      const allotment = document.querySelector('.split-view-container, [class*="allotment"]')
      if (allotment) {
        const panes = allotment.querySelectorAll('[class*="pane"]')
        if (panes.length === 2) return 'split'
      }

      // Check for editor only
      const editorOnly = document.querySelector('.monaco-editor')
      const preview = document.querySelector('.markdown-preview')

      if (editorOnly && !preview) return 'editor-only'
      if (preview && !editorOnly) return 'preview-only'

      return 'split'
    })
  }

  /**
   * Send a menu command via IPC (simulates menu click)
   */
  async sendMenuCommand(command: string): Promise<void> {
    await this.electronApp.evaluate(async ({ }, cmd) => {
      const { BrowserWindow } = require('electron')
      const windows = BrowserWindow.getAllWindows()
      if (windows.length > 0) {
        windows[0].webContents.send('menu:command', cmd)
      }
    }, command)
  }

  /**
   * Toggle between view modes
   */
  async setViewMode(mode: 'editor-only' | 'split' | 'preview-only'): Promise<void> {
    await this.sendMenuCommand(`view:${mode}`)
    // Wait for view to update
    await this.page.waitForTimeout(500)
  }
}
