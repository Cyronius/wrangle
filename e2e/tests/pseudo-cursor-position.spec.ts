import { test, expect, waitForAppReady } from '../fixtures'
import { PreviewHelpers } from '../helpers/preview-helpers'
import { EditorHelpers } from '../helpers/editor-helpers'

/**
 * E2E tests for pseudo-cursor positioning in preview.
 * Tests that the visual cursor in the preview matches the editor cursor position.
 */

const TEST_CONTENT = `# Tangle

> A modern, feature-rich desktop Markdown editor built with Electron, React, and TypeScript

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-1.0.0-green.svg)

Tangle is a powerful desktop Markdown editor that combines the Monaco Editor with live preview, syntax highlighting, mathematical formula rendering, and diagram support. Whether you're writing documentation, taking notes, or creating content, Tangle provides a seamless editing experience with professional-grade features.

## Key Features

- **Monaco Editor** - The same powerful code editor that powers VS Code
- **Live Preview** - Real-time Markdown rendering with scroll synchronization
- **Math Support** - Beautiful mathematical formulas with KaTeX
- **Diagrams** - Create flowcharts, sequence diagrams, and more with Mermaid
- **Multi-tab Interface** - Work with multiple files simultaneously
- **Smart Image Handling** - Drag-and-drop images with automatic asset management
- **Dark/Light Themes** - Choose your preferred visual style`

test.describe('Pseudo-Cursor Position in Preview', () => {
  test.beforeEach(async ({ window }) => {
    await waitForAppReady(window)
  })

  test('pseudo-cursor in H1 matches click position', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    await editor.setContent(TEST_CONTENT)
    await window.waitForTimeout(1000)

    // Click between 'n' and 'g' in "Tangle" (offset 4 in "Tangle")
    // Raw: "# Tangle" -> click at column 6 (after "# Tang")
    // Rendered: "Tangle" -> pseudo-cursor should be at offset 4 (between 'n' and 'g')
    await preview.clickOnTextAtOffset('h1', 'Tangle', 4) // Click after 'n', before 'g'
    await window.waitForTimeout(500)

    // Get editor cursor position to verify click worked
    const editorPos = await editor.getCursorLineColumn()
    console.log('[TEST] Editor cursor position:', editorPos)
    expect(editorPos.line).toBe(1)
    expect(editorPos.column).toBe(7) // "# Tang" = 6 chars, so column 7 is between 'n' and 'g'

    // Now verify pseudo-cursor position matches the clicked text position
    // Get the bounding rect of the text at the click position
    const textRect = await window.evaluate(() => {
      const h1 = document.querySelector('.markdown-preview h1')
      if (!h1) return null

      // Find the text node
      const walker = document.createTreeWalker(h1, NodeFilter.SHOW_TEXT, null)
      const textNode = walker.nextNode() as Text
      if (!textNode) return null

      // Get the rect for the position between 'n' and 'g' (offset 4)
      const range = document.createRange()
      range.setStart(textNode, 4)
      range.setEnd(textNode, 4)
      const rect = range.getBoundingClientRect()

      return { left: rect.left, top: rect.top }
    })

    // Get pseudo-cursor position
    const cursorPos = await preview.getPseudoCursorPosition()
    console.log('[TEST] Text rect:', textRect)
    console.log('[TEST] Pseudo-cursor position:', cursorPos)

    expect(cursorPos).not.toBeNull()
    expect(textRect).not.toBeNull()

    if (cursorPos && textRect) {
      // The pseudo-cursor left position should be close to the text position
      // Allow 10px tolerance for rendering differences
      const previewRect = await window.evaluate(() => {
        const preview = document.querySelector('.markdown-preview')
        if (!preview) return null
        const rect = preview.getBoundingClientRect()
        return { left: rect.left, scrollTop: (preview as HTMLElement).scrollTop }
      })

      if (previewRect) {
        const expectedLeft = textRect.left - previewRect.left
        console.log('[TEST] Expected left:', expectedLeft, 'Actual left:', cursorPos.left)
        expect(Math.abs(cursorPos.left - expectedLeft)).toBeLessThan(10)
      }
    }
  })

  test('pseudo-cursor in H2 matches click position', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    await editor.setContent(TEST_CONTENT)
    await window.waitForTimeout(1000)

    // Click on 'a' in "Features" (offset 2 in "Features")
    // Raw: "## Key Features" -> 'a' is at column 10
    // Rendered: "Key Features" -> 'a' is at offset 6 (K-e-y- -F-e-a)
    await preview.clickOnTextAtOffset('h2', 'Features', 2) // Click on 'a'
    await window.waitForTimeout(500)

    const editorPos = await editor.getCursorLineColumn()
    console.log('[TEST H2] Editor cursor position:', editorPos)
    expect(editorPos.line).toBe(10)
    expect(editorPos.column).toBe(11) // "## Key Fea" = 10 chars, so column 11 is after 'a'

    // Verify pseudo-cursor is visible
    const cursorPos = await preview.getPseudoCursorPosition()
    console.log('[TEST H2] Pseudo-cursor position:', cursorPos)
    expect(cursorPos).not.toBeNull()
  })

  test('pseudo-cursor in list item with bold matches click position', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    await editor.setContent(TEST_CONTENT)
    await window.waitForTimeout(1000)

    // Click on 'n' in "Monaco" inside bold (offset 2 in "Monaco")
    // Raw: "- **Monaco Editor**..." -> 'n' is at column 7
    // Rendered list item contains "Monaco Editor - ..."
    await preview.clickOnTextAtOffset('li strong', 'Monaco', 2) // Click on 'n'
    await window.waitForTimeout(500)

    const editorPos = await editor.getCursorLineColumn()
    console.log('[TEST List] Editor cursor position:', editorPos)
    expect(editorPos.line).toBe(12)
    expect(editorPos.column).toBe(7) // "- **Mo" = 6 chars, so 'n' is at column 7

    // Verify pseudo-cursor is visible
    const cursorPos = await preview.getPseudoCursorPosition()
    console.log('[TEST List] Pseudo-cursor position:', cursorPos)
    expect(cursorPos).not.toBeNull()
  })

  test('pseudo-cursor in blockquote matches click position', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    await editor.setContent(TEST_CONTENT)
    await window.waitForTimeout(1000)

    // Click on 'e' in "modern" (offset 3 in "modern")
    // Raw: "> A modern..." -> 'e' is at column 8
    await preview.clickOnTextAtOffset('blockquote', 'modern', 3) // Click on 'e'
    await window.waitForTimeout(500)

    const editorPos = await editor.getCursorLineColumn()
    console.log('[TEST Blockquote] Editor cursor position:', editorPos)
    expect(editorPos.line).toBe(3)
    expect(editorPos.column).toBe(8) // "> A mod" = 7 chars, so 'e' is at column 8

    // Verify pseudo-cursor is visible
    const cursorPos = await preview.getPseudoCursorPosition()
    console.log('[TEST Blockquote] Pseudo-cursor position:', cursorPos)
    expect(cursorPos).not.toBeNull()
  })
})
