import { Page, ElectronApplication } from '@playwright/test'
import path from 'path'
import fs from 'fs'

/**
 * Helper class for file operations in tests
 */
export class FileHelpers {
  constructor(
    private page: Page,
    private electronApp: ElectronApplication
  ) {}

  /**
   * Open a markdown file by simulating the open file dialog result
   */
  async openMarkdownFile(filePath: string): Promise<void> {
    const absolutePath = path.resolve(filePath)
    const content = fs.readFileSync(absolutePath, 'utf-8')

    // Simulate the file open via IPC
    await this.electronApp.evaluate(
      async ({ }, { path: fPath, content: fContent }) => {
        const { BrowserWindow } = require('electron')
        const windows = BrowserWindow.getAllWindows()
        if (windows.length > 0) {
          // Send the file data as if it was opened via dialog
          windows[0].webContents.send('file:opened', {
            path: fPath,
            content: fContent
          })
        }
      },
      { path: absolutePath, content }
    )
  }

  /**
   * Create a temporary markdown file for testing
   */
  async createTempMarkdownFile(filename: string, content: string): Promise<string> {
    const tempDir = path.join(__dirname, '../../test-temp')

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }

    const filePath = path.join(tempDir, filename)
    fs.writeFileSync(filePath, content, 'utf-8')

    return filePath
  }

  /**
   * Clean up temporary test files
   */
  async cleanupTempFiles(): Promise<void> {
    const tempDir = path.join(__dirname, '../../test-temp')

    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  }

  /**
   * Set file content directly via keyboard input
   */
  async setFileContent(content: string): Promise<void> {
    // Focus editor
    await this.page.click('.monaco-editor')

    // Select all
    await this.page.keyboard.press('Control+a')

    // Type new content
    await this.page.keyboard.type(content, { delay: 0 })

    // Wait for preview to update
    await this.page.waitForTimeout(500)
  }
}
