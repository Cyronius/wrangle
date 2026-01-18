import { test, expect, waitForAppReady } from '../fixtures'
import { PreviewHelpers } from '../helpers/preview-helpers'
import { EditorHelpers } from '../helpers/editor-helpers'

/**
 * E2E tests for cursor positioning in preview using native contentEditable.
 * Tests that clicking in the preview places the cursor and syncs to editor.
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

test.describe('Native Cursor Position in Preview', () => {
  test.beforeEach(async ({ window }) => {
    await waitForAppReady(window)
  })

  test('clicking in H1 positions cursor and syncs to editor', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    await editor.setContent(TEST_CONTENT)
    await window.waitForTimeout(1000)

    // Click between 'n' and 'g' in "Tangle" (offset 4 in "Tangle")
    // Raw: "# Tangle" -> click at column 6 (after "# Tang")
    await preview.clickOnTextAtOffset('h1', 'Tangle', 4)
    await window.waitForTimeout(500)

    // Get editor cursor position to verify click worked
    const editorPos = await editor.getCursorLineColumn()
    console.log('[TEST] Editor cursor position:', editorPos)
    expect(editorPos.line).toBe(1)
    expect(editorPos.column).toBe(7) // "# Tang" = 6 chars, so column 7 is between 'n' and 'g'

    // Verify the native browser selection is in the preview
    const selectionInfo = await window.evaluate(() => {
      const sel = window.getSelection()
      if (!sel || sel.rangeCount === 0) return null
      const range = sel.getRangeAt(0)
      const container = range.startContainer
      const element = container.nodeType === Node.TEXT_NODE
        ? container.parentElement
        : container as Element
      return {
        isCollapsed: sel.isCollapsed,
        offset: sel.anchorOffset,
        isInPreview: !!element?.closest('.markdown-preview'),
        isInH1: !!element?.closest('h1')
      }
    })

    console.log('[TEST] Selection info:', selectionInfo)
    // The cursor should be in the preview area
    expect(selectionInfo?.isInPreview).toBe(true)
  })

  test('clicking in H2 positions cursor correctly', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    await editor.setContent(TEST_CONTENT)
    await window.waitForTimeout(1000)

    // Click on 'a' in "Features" (offset 2 in "Features")
    // Raw: "## Key Features" -> 'a' is at column 10
    await preview.clickOnTextAtOffset('h2', 'Features', 2)
    await window.waitForTimeout(500)

    const editorPos = await editor.getCursorLineColumn()
    console.log('[TEST H2] Editor cursor position:', editorPos)
    expect(editorPos.line).toBe(10)
    expect(editorPos.column).toBe(11) // "## Key Fea" = 10 chars, so column 11 is after 'a'

    // Verify native cursor is placed
    const isInPreview = await window.evaluate(() => {
      const sel = window.getSelection()
      if (!sel || sel.rangeCount === 0) return false
      const container = sel.getRangeAt(0).startContainer
      const element = container.nodeType === Node.TEXT_NODE
        ? container.parentElement
        : container as Element
      return !!element?.closest('.markdown-preview')
    })
    expect(isInPreview).toBe(true)
  })

  test('clicking in list item with bold syncs to editor', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    await editor.setContent(TEST_CONTENT)
    await window.waitForTimeout(1000)

    // Click on 'n' in "Monaco" inside bold (offset 2 in "Monaco")
    // Raw: "- **Monaco Editor**..." -> 'n' is at column 7
    await preview.clickOnTextAtOffset('li strong', 'Monaco', 2)
    await window.waitForTimeout(500)

    const editorPos = await editor.getCursorLineColumn()
    console.log('[TEST List] Editor cursor position:', editorPos)
    expect(editorPos.line).toBe(12)
    expect(editorPos.column).toBe(7) // "- **Mo" = 6 chars, so 'n' is at column 7

    // Verify native cursor is placed
    const isInPreview = await window.evaluate(() => {
      const sel = window.getSelection()
      if (!sel || sel.rangeCount === 0) return false
      const container = sel.getRangeAt(0).startContainer
      const element = container.nodeType === Node.TEXT_NODE
        ? container.parentElement
        : container as Element
      return !!element?.closest('.markdown-preview')
    })
    expect(isInPreview).toBe(true)
  })

  test('clicking in blockquote syncs to editor', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    await editor.setContent(TEST_CONTENT)
    await window.waitForTimeout(1000)

    // Click on 'e' in "modern" (offset 3 in "modern")
    // Raw: "> A modern..." -> 'e' is at column 8
    await preview.clickOnTextAtOffset('blockquote', 'modern', 3)
    await window.waitForTimeout(500)

    const editorPos = await editor.getCursorLineColumn()
    console.log('[TEST Blockquote] Editor cursor position:', editorPos)
    expect(editorPos.line).toBe(3)
    expect(editorPos.column).toBe(8) // "> A mod" = 7 chars, so 'e' is at column 8

    // Verify native cursor is placed
    const isInPreview = await window.evaluate(() => {
      const sel = window.getSelection()
      if (!sel || sel.rangeCount === 0) return false
      const container = sel.getRangeAt(0).startContainer
      const element = container.nodeType === Node.TEXT_NODE
        ? container.parentElement
        : container as Element
      return !!element?.closest('.markdown-preview')
    })
    expect(isInPreview).toBe(true)
  })
})
