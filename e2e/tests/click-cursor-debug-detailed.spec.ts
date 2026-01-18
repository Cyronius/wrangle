import { test, expect, waitForAppReady } from '../fixtures'
import { PreviewHelpers } from '../helpers/preview-helpers'
import { EditorHelpers } from '../helpers/editor-helpers'

/**
 * Detailed debug tests for click-to-cursor positioning.
 * These tests log detailed information about the source mapping.
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

test.describe('Click-to-Cursor Debug Detailed', () => {
  test.beforeEach(async ({ window }) => {
    await waitForAppReady(window)
    // Enable console logging
    window.on('console', msg => {
      const text = msg.text()
      if (text.includes('[TEST]') || text.includes('[DEBUG]') || text.includes('offsetMap') || text.includes('extractPlainText')) {
        console.log(`[BROWSER] ${text}`)
      }
    })
  })

  test('debug H1 offset mapping', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    await editor.setContent(TEST_CONTENT)
    await window.waitForTimeout(1000)

    // Get detailed info about the H1 element
    const h1Info = await window.evaluate(() => {
      const h1 = document.querySelector('.markdown-preview h1[data-source-id]')
      if (!h1) return null

      const sourceId = h1.getAttribute('data-source-id')
      const textContent = h1.textContent
      const innerHTML = h1.innerHTML

      // Try to access the source map if available
      // @ts-ignore
      const sourceMap = (window as any).__debugSourceMap

      return {
        sourceId,
        textContent,
        innerHTML,
        tagName: h1.tagName
      }
    })

    console.log('[TEST] H1 element info:', JSON.stringify(h1Info, null, 2))

    // Click on 'a' in "Tangle" and check position
    await preview.clickOnTextAtOffset('h1', 'Tangle', 1) // 'a'
    await window.waitForTimeout(300)

    const pos = await editor.getCursorLineColumn()
    console.log('[TEST] Cursor after clicking "a" in Tangle:', pos)

    // The source is "# Tangle"
    // Position 0: '#'
    // Position 1: ' '
    // Position 2: 'T'
    // Position 3: 'a' <- expected column 4 (1-indexed)
    expect(pos.line).toBe(1)
    expect(pos.column).toBe(4)
  })

  test('debug list item offset mapping', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    await editor.setContent(TEST_CONTENT)
    await window.waitForTimeout(1000)

    // Get detailed info about the list element
    const listInfo = await window.evaluate(() => {
      const ul = document.querySelector('.markdown-preview ul[data-source-id]')
      if (!ul) return null

      const sourceId = ul.getAttribute('data-source-id')
      const firstLi = ul.querySelector('li')

      return {
        sourceId,
        tagName: ul.tagName,
        ulTextContent: ul.textContent?.substring(0, 100),
        firstLiTextContent: firstLi?.textContent?.substring(0, 100),
        firstLiInnerHTML: firstLi?.innerHTML?.substring(0, 200)
      }
    })

    console.log('[TEST] List element info:', JSON.stringify(listInfo, null, 2))

    // Click on 'E' in "Editor" (inside bold)
    // Line 12: "- **Monaco Editor** - The same powerful..."
    // "- **Monaco " = 11 chars (0-10), 'E' at position 11 -> column 12
    await preview.clickOnTextAtOffset('li strong', 'Editor', 0)
    await window.waitForTimeout(300)

    const pos = await editor.getCursorLineColumn()
    console.log('[TEST] Cursor after clicking "E" in Editor (bold):', pos)

    expect(pos.line).toBe(12)
    expect(pos.column).toBe(12)
  })

  test('verify cursor selection after click', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    await editor.setContent(TEST_CONTENT)
    await window.waitForTimeout(1000)

    // Click at start of "Tangle" and select the whole word
    await preview.clickOnTextAtOffset('h1', 'Tangle', 0)
    await window.waitForTimeout(200)

    // Select "Tangle" by shift+arrow right 6 times
    for (let i = 0; i < 6; i++) {
      await window.keyboard.press('Shift+ArrowRight')
    }
    await window.waitForTimeout(100)

    const selection = await editor.getSelection()
    console.log('[TEST] Selection after clicking start of "Tangle" and selecting 6 chars:', selection)

    // Should select exactly "Tangle"
    expect(selection).toBe('Tangle')
  })

  test('verify list item cursor selection', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    await editor.setContent(TEST_CONTENT)
    await window.waitForTimeout(1000)

    // Click at start of "Monaco" in first list item
    await preview.clickOnTextAtOffset('li strong', 'Monaco', 0)
    await window.waitForTimeout(200)

    // Select "Monaco" by shift+arrow right 6 times
    for (let i = 0; i < 6; i++) {
      await window.keyboard.press('Shift+ArrowRight')
    }
    await window.waitForTimeout(100)

    const selection = await editor.getSelection()
    console.log('[TEST] Selection after clicking start of "Monaco" and selecting 6 chars:', selection)

    // Should select exactly "Monaco"
    expect(selection).toBe('Monaco')
  })
})
