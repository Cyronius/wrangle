import { Page } from '@playwright/test'

/**
 * Helper class for Monaco editor interactions
 */
export class EditorHelpers {
  constructor(private page: Page) {}

  /**
   * Set content in the Monaco editor using clipboard paste (fast)
   */
  async setContent(content: string): Promise<void> {
    // Click on the editor to focus it
    await this.page.click('.monaco-editor .view-lines')

    // Select all existing content
    await this.page.keyboard.press('Control+a')

    // Use evaluate to set content directly through Monaco's API
    await this.page.evaluate((text) => {
      // Find Monaco editor instances in the window
      // @ts-ignore - Monaco exposes this globally
      const editors = (window as any).monaco?.editor?.getEditors?.()
      if (editors && editors.length > 0) {
        const editor = editors[0]
        editor.setValue(text)
        return true
      }
      return false
    }, content)

    // Wait for content to settle and preview to render
    await this.page.waitForTimeout(500)

    // Click again and press Home to set cursor position and trigger cursor change event
    await this.page.click('.monaco-editor .view-lines')
    await this.page.keyboard.press('Control+Home')
    await this.page.waitForTimeout(200)
  }

  /**
   * Get the current editor content
   */
  async getContent(): Promise<string> {
    return this.page.evaluate(() => {
      // Access Monaco editor instance through the DOM
      const editorElement = document.querySelector('.monaco-editor')
      if (!editorElement) return ''

      // Monaco stores content in view lines
      const lines = document.querySelectorAll('.monaco-editor .view-lines .view-line')
      return Array.from(lines)
        .map((line) => line.textContent || '')
        .join('\n')
    })
  }

  /**
   * Move cursor to a specific line and column
   */
  async setCursorPosition(line: number, column: number): Promise<void> {
    // Use Ctrl+G to open "Go to Line" dialog
    await this.page.keyboard.press('Control+g')
    await this.page.waitForSelector('.quick-input-widget', { state: 'visible' })

    // Type line number
    await this.page.keyboard.type(`${line}:${column}`)
    await this.page.keyboard.press('Enter')

    // Wait for dialog to close
    await this.page.waitForSelector('.quick-input-widget', { state: 'hidden' })
  }

  /**
   * Click at a specific position in the editor
   */
  async clickAtLine(lineNumber: number): Promise<void> {
    const lineSelector = `.monaco-editor .view-lines .view-line:nth-child(${lineNumber})`
    await this.page.click(lineSelector)
  }

  /**
   * Get cursor position as character offset
   */
  async getCursorOffset(): Promise<number | null> {
    return this.page.evaluate(() => {
      // This relies on Monaco's internal state
      // We can approximate by finding the cursor element position
      const cursor = document.querySelector('.monaco-editor .cursor')
      if (!cursor) return null

      const cursorRect = cursor.getBoundingClientRect()
      const editorRect = document.querySelector('.monaco-editor')?.getBoundingClientRect()

      if (!editorRect) return null

      // Return approximate position
      return Math.round((cursorRect.top - editorRect.top) / 20) // Approximate line height
    })
  }

  /**
   * Trigger a scroll in the editor
   */
  async scrollToLine(lineNumber: number): Promise<void> {
    await this.page.evaluate((line) => {
      const viewLines = document.querySelector('.monaco-editor .view-lines')
      if (viewLines) {
        const lineHeight = 20 // Approximate line height
        ;(viewLines as HTMLElement).scrollTop = (line - 1) * lineHeight
      }
    }, lineNumber)
  }

  /**
   * Insert text at current cursor position
   */
  async typeText(text: string): Promise<void> {
    await this.page.click('.monaco-editor')
    await this.page.keyboard.type(text)
  }

  /**
   * Wait for specific content to appear in editor
   */
  async waitForContent(expectedContent: string, timeout = 5000): Promise<void> {
    await this.page.waitForFunction(
      (content) => {
        const lines = document.querySelectorAll('.monaco-editor .view-lines .view-line')
        const text = Array.from(lines)
          .map((l) => l.textContent || '')
          .join('\n')
        return text.includes(content)
      },
      expectedContent,
      { timeout }
    )
  }

  /**
   * Get cursor line and column position using Monaco API
   */
  async getCursorLineColumn(): Promise<{ line: number; column: number }> {
    return this.page.evaluate(() => {
      const editors = (window as any).monaco?.editor?.getEditors?.()
      if (editors?.[0]) {
        const pos = editors[0].getPosition()
        return { line: pos.lineNumber, column: pos.column }
      }
      return { line: 0, column: 0 }
    })
  }

  /**
   * Get currently selected text in the editor
   */
  async getSelection(): Promise<string> {
    return this.page.evaluate(() => {
      const editors = (window as any).monaco?.editor?.getEditors?.()
      if (editors?.[0]) {
        const model = editors[0].getModel()
        const selection = editors[0].getSelection()
        if (model && selection) {
          return model.getValueInRange(selection)
        }
      }
      return ''
    })
  }

  /**
   * Get the full editor content using Monaco API
   */
  async getFullContent(): Promise<string> {
    return this.page.evaluate(() => {
      const editors = (window as any).monaco?.editor?.getEditors?.()
      if (editors?.[0]) {
        const model = editors[0].getModel()
        if (model) {
          return model.getValue()
        }
      }
      return ''
    })
  }

  /**
   * Focus the editor without changing cursor position
   */
  async focus(): Promise<void> {
    await this.page.evaluate(() => {
      const editors = (window as any).monaco?.editor?.getEditors?.()
      if (editors?.[0]) {
        editors[0].focus()
      }
    })
    await this.page.waitForTimeout(50)
  }
}
