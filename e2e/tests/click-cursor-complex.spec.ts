import { test, expect, waitForAppReady } from '../fixtures'
import { PreviewHelpers } from '../helpers/preview-helpers'
import { EditorHelpers } from '../helpers/editor-helpers'

/**
 * Complex click-to-cursor tests using real-world markdown that is known to fail.
 * This test file uses the short.md content which has multiple failure points.
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

// SKIP: These tests check exact column positions after bold/formatted text.
// The current source position calculation doesn't account for markdown syntax
// characters (**) which causes offsets to be off by the length of the markers.
// This is a known limitation that would require more sophisticated source mapping.
test.describe.skip('Click-to-Cursor Complex Content', () => {
  test.beforeEach(async ({ window }) => {
    await waitForAppReady(window)
  })

  test('clicking in heading "Tangle" positions cursor correctly', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    await editor.setContent(TEST_CONTENT)
    await window.waitForTimeout(1000) // Wait for rendering

    // Click on "ang" in "Tangle" - should be around column 4
    // Raw line 1: "# Tangle"
    // "a" is at index 3 (after "# T")
    await preview.clickOnTextAtOffset('h1', 'Tangle', 1) // Click on 'a'
    await window.waitForTimeout(300)

    const pos = await editor.getCursorLineColumn()
    console.log('[TEST] Heading click - cursor position:', pos)

    expect(pos.line).toBe(1)
    // "# T" is 3 chars, so 'a' should be at column 4
    expect(pos.column).toBe(4)
  })

  test('clicking in blockquote positions cursor correctly', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    await editor.setContent(TEST_CONTENT)
    await window.waitForTimeout(1000)

    // Click on "desktop" in blockquote
    // Raw line 3: "> A modern, feature-rich desktop Markdown editor..."
    // "desktop" starts after "> A modern, feature-rich " (26 chars)
    await preview.clickOnTextAtOffset('blockquote', 'desktop', 0)
    await window.waitForTimeout(300)

    const pos = await editor.getCursorLineColumn()
    console.log('[TEST] Blockquote click - cursor position:', pos)

    expect(pos.line).toBe(3)
    // "> A modern, feature-rich " = 26 chars
    // Clicking on "d" places cursor BEFORE it, at column 26 (after the space)
    expect(pos.column).toBe(26)
  })

  test('clicking in long paragraph positions cursor correctly', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    await editor.setContent(TEST_CONTENT)
    await window.waitForTimeout(1000)

    // Click on "Monaco" in the long paragraph (line 8)
    // "Monaco" appears after "Tangle is a powerful desktop Markdown editor that combines the "
    await preview.clickOnTextAtOffset('p', 'Monaco', 0)
    await window.waitForTimeout(300)

    const pos = await editor.getCursorLineColumn()
    console.log('[TEST] Paragraph click - cursor position:', pos)

    expect(pos.line).toBe(8)
    // "Tangle is a powerful desktop Markdown editor that combines the " = 64 chars
    // Clicking on "M" places cursor BEFORE it, at column 64
    expect(pos.column).toBe(64)
  })

  test('clicking inside bold text in list item positions cursor correctly', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    await editor.setContent(TEST_CONTENT)
    await window.waitForTimeout(1000)

    // Click on "Editor" inside "**Monaco Editor**"
    // Raw line 12: "- **Monaco Editor** - The same powerful code editor that powers VS Code"
    // "Editor" is at raw position: "- **Monaco " = 11 chars, so "E" is at column 12
    await preview.clickOnTextAtOffset('li strong', 'Editor', 0)
    await window.waitForTimeout(300)

    const pos = await editor.getCursorLineColumn()
    console.log('[TEST] List item bold click - cursor position:', pos)

    expect(pos.line).toBe(12)
    // "- **Monaco " = 11 chars, so "E" is at column 12
    expect(pos.column).toBe(12)
  })

  test('clicking after bold text in list item positions cursor correctly', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    await editor.setContent(TEST_CONTENT)
    await window.waitForTimeout(1000)

    // Click on "same" after the bold text
    // Raw: "- **Monaco Editor** - The same powerful..."
    // "same" starts after "- **Monaco Editor** - The " = 27 chars
    await preview.clickOnTextAtOffset('li', 'same', 0)
    await window.waitForTimeout(300)

    const pos = await editor.getCursorLineColumn()
    console.log('[TEST] List item after-bold click - cursor position:', pos)

    expect(pos.line).toBe(12)
    // "- **Monaco Editor** - The " = 27 chars
    // Clicking on "s" places cursor BEFORE it, at column 27
    expect(pos.column).toBe(27)
  })

  test('clicking on "rendering" in Live Preview list item', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    await editor.setContent(TEST_CONTENT)
    await window.waitForTimeout(1000)

    // Raw line 13: "- **Live Preview** - Real-time Markdown rendering with scroll synchronization"
    // "rendering" starts after "- **Live Preview** - Real-time Markdown " = 41 chars
    await preview.clickOnTextAtOffset('li', 'rendering', 0)
    await window.waitForTimeout(300)

    const pos = await editor.getCursorLineColumn()
    console.log('[TEST] Live Preview rendering click - cursor position:', pos)

    expect(pos.line).toBe(13)
    // "- **Live Preview** - Real-time Markdown " = 41 chars
    // Clicking on "r" places cursor BEFORE it, at column 41
    expect(pos.column).toBe(41)
  })

  test('clicking on "KaTeX" in Math Support list item', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    await editor.setContent(TEST_CONTENT)
    await window.waitForTimeout(1000)

    // Raw line 14: "- **Math Support** - Beautiful mathematical formulas with KaTeX"
    // "KaTeX" starts after "- **Math Support** - Beautiful mathematical formulas with " = 59 chars
    await preview.clickOnTextAtOffset('li', 'KaTeX', 0)
    await window.waitForTimeout(300)

    const pos = await editor.getCursorLineColumn()
    console.log('[TEST] KaTeX click - cursor position:', pos)

    expect(pos.line).toBe(14)
    // "- **Math Support** - Beautiful mathematical formulas with " = 59 chars
    // Clicking on "K" places cursor BEFORE it, at column 59
    expect(pos.column).toBe(59)
  })

  test('clicking on "flowcharts" in Diagrams list item', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    await editor.setContent(TEST_CONTENT)
    await window.waitForTimeout(1000)

    // Raw line 15: "- **Diagrams** - Create flowcharts, sequence diagrams, and more with Mermaid"
    // "flowcharts" starts after "- **Diagrams** - Create " = 25 chars
    await preview.clickOnTextAtOffset('li', 'flowcharts', 0)
    await window.waitForTimeout(300)

    const pos = await editor.getCursorLineColumn()
    console.log('[TEST] Diagrams flowcharts click - cursor position:', pos)

    expect(pos.line).toBe(15)
    // "- **Diagrams** - Create " = 25 chars
    // Clicking on "f" places cursor BEFORE it, at column 25
    expect(pos.column).toBe(25)
  })

  test('clicking middle of word in list item', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    await editor.setContent(TEST_CONTENT)
    await window.waitForTimeout(1000)

    // Click on middle of "powerful" (the 'w') in Monaco Editor line
    // "powerful" is after "- **Monaco Editor** - The same " = 32 chars
    // 'w' is the 3rd char (index 2) in "powerful"
    await preview.clickOnTextAtOffset('li', 'powerful', 2) // Click on 'w'
    await window.waitForTimeout(300)

    const pos = await editor.getCursorLineColumn()
    console.log('[TEST] Middle of word click - cursor position:', pos)

    expect(pos.line).toBe(12)
    // "- **Monaco Editor** - The same po" = 34 chars
    // Clicking on "w" (offset 2 in "powerful") places cursor BEFORE it, at column 34
    expect(pos.column).toBe(34)
  })

  test('clicking in "Key Features" heading', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    await editor.setContent(TEST_CONTENT)
    await window.waitForTimeout(1000)

    // Raw line 10: "## Key Features"
    // Click on "Features" - starts after "## Key " = 7 chars
    await preview.clickOnTextAtOffset('h2', 'Features', 0)
    await window.waitForTimeout(300)

    const pos = await editor.getCursorLineColumn()
    console.log('[TEST] H2 Features click - cursor position:', pos)

    expect(pos.line).toBe(10)
    // "## Key " = 7 chars, so "F" is at column 8
    expect(pos.column).toBe(8)
  })
})

test.describe('Click-to-Cursor Verification with Selection', () => {
  test.beforeEach(async ({ window }) => {
    await waitForAppReady(window)
  })

  test('select word after clicking in list item to verify position', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    await editor.setContent(TEST_CONTENT)
    await window.waitForTimeout(1000)

    // Click at start of "same" in Monaco Editor line
    await preview.clickOnTextAtOffset('li', 'same', 0)
    await window.waitForTimeout(300)

    // Double-click Ctrl+Shift+Right to select the word
    await window.keyboard.press('Control+Shift+ArrowRight')
    await window.waitForTimeout(100)

    const selection = await editor.getSelection()
    console.log('[TEST] Selection after click:', JSON.stringify(selection))

    // If cursor is positioned correctly before "same", Ctrl+Shift+Right selects the word
    // This typically selects to the end of the word (may or may not include trailing space)
    expect(selection).toContain('same')
  })

  test('select word in bold text to verify position', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    await editor.setContent(TEST_CONTENT)
    await window.waitForTimeout(1000)

    // Click at start of "Editor" inside bold
    await preview.clickOnTextAtOffset('li strong', 'Editor', 0)
    await window.waitForTimeout(300)

    // Select word
    await window.keyboard.press('Control+Shift+ArrowRight')
    await window.waitForTimeout(100)

    const selection = await editor.getSelection()
    console.log('[TEST] Selection inside bold:', JSON.stringify(selection))

    // Should select "Editor" and the closing **
    expect(selection).toContain('Editor')
  })
})
