import { Page } from '@playwright/test'

/**
 * Helper class for CodeMirror editor interactions
 */
export class EditorHelpers {
  constructor(private page: Page) {}

  /**
   * Set content in the CodeMirror editor
   */
  async setContent(content: string): Promise<void> {
    // Focus the editor
    await this.page.click('.cm-editor .cm-content')

    // Use CodeMirror's dispatch to replace content
    await this.page.evaluate((text) => {
      const view = (window as any).__codeMirrorView
      if (!view) return false

      const currentLength = view.state.doc.length
      view.dispatch({
        changes: { from: 0, to: currentLength, insert: text }
      })
      return true
    }, content)

    // Wait for content to settle and preview to render
    await this.page.waitForTimeout(500)

    // Move cursor to start
    await this.page.evaluate(() => {
      const view = (window as any).__codeMirrorView
      if (view) {
        view.dispatch({ selection: { anchor: 0, head: 0 } })
      }
    })
    await this.page.waitForTimeout(200)
  }

  /**
   * Get the current editor content
   */
  async getContent(): Promise<string> {
    return this.getFullContent()
  }

  /**
   * Move cursor to a specific line and column
   */
  async setCursorPosition(line: number, column: number): Promise<void> {
    await this.page.evaluate(
      ({ targetLine, targetColumn }) => {
        const view = (window as any).__codeMirrorView
        if (!view) return

        const lineInfo = view.state.doc.line(targetLine)
        const offset = lineInfo.from + targetColumn - 1 // Convert to 0-indexed

        view.dispatch({
          selection: { anchor: offset, head: offset }
        })
      },
      { targetLine: line, targetColumn: column }
    )
  }

  /**
   * Click at a specific position in the editor
   */
  async clickAtLine(lineNumber: number): Promise<void> {
    // Use setCursorPosition as a fallback since CodeMirror doesn't have simple line selectors
    await this.setCursorPosition(lineNumber, 1)
  }

  /**
   * Get cursor position as character offset
   */
  async getCursorOffset(): Promise<number | null> {
    return this.page.evaluate(() => {
      const view = (window as any).__codeMirrorView
      if (!view) return null
      return view.state.selection.main.head
    })
  }

  /**
   * Trigger a scroll in the editor
   */
  async scrollToLine(lineNumber: number): Promise<void> {
    await this.page.evaluate((line) => {
      const view = (window as any).__codeMirrorView
      if (!view) return

      const lineInfo = view.state.doc.line(line)
      // Import EditorView.scrollIntoView effect
      view.dispatch({
        effects: view.constructor.scrollIntoView(lineInfo.from, { y: 'start' })
      })
    }, lineNumber)
  }

  /**
   * Insert text at current cursor position
   */
  async typeText(text: string): Promise<void> {
    await this.page.click('.cm-editor .cm-content')
    await this.page.keyboard.type(text)
  }

  /**
   * Wait for specific content to appear in editor
   */
  async waitForContent(expectedContent: string, timeout = 5000): Promise<void> {
    await this.page.waitForFunction(
      (content) => {
        const view = (window as any).__codeMirrorView
        if (!view) return false
        return view.state.doc.toString().includes(content)
      },
      expectedContent,
      { timeout }
    )
  }

  /**
   * Get cursor line and column position using CodeMirror API
   */
  async getCursorLineColumn(): Promise<{ line: number; column: number }> {
    return this.page.evaluate(() => {
      const view = (window as any).__codeMirrorView
      if (!view) return { line: 0, column: 0 }

      const offset = view.state.selection.main.head
      const line = view.state.doc.lineAt(offset)

      return {
        line: line.number, // 1-indexed line number
        column: offset - line.from + 1 // 1-indexed column
      }
    })
  }

  /**
   * Get currently selected text in the editor
   */
  async getSelection(): Promise<string> {
    return this.page.evaluate(() => {
      const view = (window as any).__codeMirrorView
      if (!view) return ''

      const { from, to } = view.state.selection.main
      return view.state.sliceDoc(from, to)
    })
  }

  /**
   * Get the full editor content using CodeMirror API
   */
  async getFullContent(): Promise<string> {
    return this.page.evaluate(() => {
      const view = (window as any).__codeMirrorView
      if (!view) return ''
      return view.state.doc.toString()
    })
  }
}
