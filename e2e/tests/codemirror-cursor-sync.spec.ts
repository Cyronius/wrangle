import { test, expect, waitForAppReady } from '../fixtures'
import { PreviewHelpers } from '../helpers/preview-helpers'
import { EditorHelpers } from '../helpers/editor-helpers'

/**
 * Comprehensive cursor sync tests for CodeMirror + Preview integration.
 * Tests that clicking in the preview correctly positions the editor cursor.
 */

test.describe('Basic Paragraph Click Positioning', () => {
  test.beforeEach(async ({ window }) => {
    await waitForAppReady(window)
  })

  test('click at start of paragraph positions cursor at column 1', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    await editor.setContent('Hello world')
    await window.waitForTimeout(500)

    await preview.clickOnTextAtOffset('p', 'Hello', 0)
    await window.waitForTimeout(200)

    const pos = await editor.getCursorLineColumn()
    expect(pos.line).toBe(1)
    expect(pos.column).toBe(1)
  })

  test('click in middle of word positions cursor correctly', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    await editor.setContent('Hello world')
    await window.waitForTimeout(500)

    // Click on 'l' in "Hello" (offset 2)
    await preview.clickOnTextAtOffset('p', 'Hello', 2)
    await window.waitForTimeout(200)

    const pos = await editor.getCursorLineColumn()
    expect(pos.line).toBe(1)
    expect(pos.column).toBe(3) // After "He"
  })

  test('click at end of paragraph positions cursor at end', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    await editor.setContent('Hello world')
    await window.waitForTimeout(500)

    // Click at end of "world" (offset 5)
    await preview.clickOnTextAtOffset('p', 'world', 5)
    await window.waitForTimeout(200)

    const pos = await editor.getCursorLineColumn()
    expect(pos.line).toBe(1)
    expect(pos.column).toBe(12) // After "Hello world"
  })

  test('click at start of second word positions cursor after space', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    await editor.setContent('Hello world test')
    await window.waitForTimeout(500)

    // Click at start of "world"
    await preview.clickOnTextAtOffset('p', 'world', 0)
    await window.waitForTimeout(200)

    const pos = await editor.getCursorLineColumn()
    expect(pos.line).toBe(1)
    expect(pos.column).toBe(7) // After "Hello "
  })
})

test.describe('Heading Click Positioning', () => {
  test.beforeEach(async ({ window }) => {
    await waitForAppReady(window)
  })

  test('H1 heading - click accounts for # prefix', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    await editor.setContent('# Heading One')
    await window.waitForTimeout(500)

    await preview.clickOnTextAtOffset('h1', 'Heading', 0)
    await window.waitForTimeout(200)

    const pos = await editor.getCursorLineColumn()
    expect(pos.line).toBe(1)
    expect(pos.column).toBe(3) // After "# "
  })

  test('H2 heading - click accounts for ## prefix', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    await editor.setContent('## Heading Two')
    await window.waitForTimeout(500)

    await preview.clickOnTextAtOffset('h2', 'Heading', 0)
    await window.waitForTimeout(200)

    const pos = await editor.getCursorLineColumn()
    expect(pos.line).toBe(1)
    expect(pos.column).toBe(4) // After "## "
  })

  test('H3 heading - click in middle of text', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    await editor.setContent('### Heading Three')
    await window.waitForTimeout(500)

    // Click on 'a' in "Heading" (offset 2)
    await preview.clickOnTextAtOffset('h3', 'Heading', 2)
    await window.waitForTimeout(200)

    const pos = await editor.getCursorLineColumn()
    expect(pos.line).toBe(1)
    expect(pos.column).toBe(7) // After "### He"
  })
})

test.describe('List Click Positioning', () => {
  test.beforeEach(async ({ window }) => {
    await waitForAppReady(window)
  })

  test('unordered list - click accounts for - prefix', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    await editor.setContent('- List item one')
    await window.waitForTimeout(500)

    await preview.clickOnTextAtOffset('li', 'List', 0)
    await window.waitForTimeout(200)

    const pos = await editor.getCursorLineColumn()
    expect(pos.line).toBe(1)
    expect(pos.column).toBe(3) // After "- "
  })

  test('ordered list - click accounts for number prefix', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    await editor.setContent('1. First item')
    await window.waitForTimeout(500)

    await preview.clickOnTextAtOffset('li', 'First', 0)
    await window.waitForTimeout(200)

    const pos = await editor.getCursorLineColumn()
    expect(pos.line).toBe(1)
    expect(pos.column).toBe(4) // After "1. "
  })

  test('nested list - second level item', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    await editor.setContent(`- Parent item
  - Child item`)
    await window.waitForTimeout(500)

    await preview.clickOnTextAtOffset('li', 'Child', 0)
    await window.waitForTimeout(200)

    const pos = await editor.getCursorLineColumn()
    expect(pos.line).toBe(2)
    expect(pos.column).toBe(5) // After "  - "
  })
})

test.describe('Formatted Text Click Positioning', () => {
  test.beforeEach(async ({ window }) => {
    await waitForAppReady(window)
  })

  test('bold text - click inside **bold**', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    await editor.setContent('Hello **bold** world')
    await window.waitForTimeout(500)

    // Use wildcard selector since Streamdown may render bold differently
    await preview.clickOnTextAtOffset('*', 'bold', 0)
    await window.waitForTimeout(200)

    const pos = await editor.getCursorLineColumn()
    expect(pos.line).toBe(1)
    expect(pos.column).toBe(9) // After "Hello **"
  })

  test('italic text - click inside *italic*', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    await editor.setContent('Hello *italic* world')
    await window.waitForTimeout(500)

    // Use wildcard selector since Streamdown may render italic differently
    await preview.clickOnTextAtOffset('*', 'italic', 0)
    await window.waitForTimeout(200)

    const pos = await editor.getCursorLineColumn()
    expect(pos.line).toBe(1)
    expect(pos.column).toBe(8) // After "Hello *"
  })

  test('inline code - click inside `code`', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    await editor.setContent('Run `command` now')
    await window.waitForTimeout(500)

    // Use wildcard selector for inline code
    await preview.clickOnTextAtOffset('*', 'command', 0)
    await window.waitForTimeout(200)

    const pos = await editor.getCursorLineColumn()
    expect(pos.line).toBe(1)
    expect(pos.column).toBe(6) // After "Run `"
  })

  test('click after bold text positions correctly', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    await editor.setContent('Hello **bold** world')
    await window.waitForTimeout(500)

    await preview.clickOnTextAtOffset('p', 'world', 0)
    await window.waitForTimeout(200)

    const pos = await editor.getCursorLineColumn()
    expect(pos.line).toBe(1)
    expect(pos.column).toBe(16) // After "Hello **bold** "
  })

  test('click in middle of bold text', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    await editor.setContent('Hello **bold** world')
    await window.waitForTimeout(500)

    // Click on 'l' in "bold" (offset 2) - use wildcard selector
    await preview.clickOnTextAtOffset('*', 'bold', 2)
    await window.waitForTimeout(200)

    const pos = await editor.getCursorLineColumn()
    expect(pos.line).toBe(1)
    expect(pos.column).toBe(11) // After "Hello **bo"
  })
})

test.describe('Blockquote Click Positioning', () => {
  test.beforeEach(async ({ window }) => {
    await waitForAppReady(window)
  })

  test('blockquote - click accounts for > prefix', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    await editor.setContent('> Quoted text here')
    await window.waitForTimeout(500)

    await preview.clickOnTextAtOffset('blockquote', 'Quoted', 0)
    await window.waitForTimeout(200)

    const pos = await editor.getCursorLineColumn()
    expect(pos.line).toBe(1)
    expect(pos.column).toBe(3) // After "> "
  })

  test('blockquote - click in middle of text', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    await editor.setContent('> Quoted text here')
    await window.waitForTimeout(500)

    // Click on 'x' in "text" (offset 2)
    await preview.clickOnTextAtOffset('blockquote', 'text', 2)
    await window.waitForTimeout(200)

    const pos = await editor.getCursorLineColumn()
    expect(pos.line).toBe(1)
    expect(pos.column).toBe(12) // After "> Quoted te"
  })
})

test.describe('Code Block Click Positioning', () => {
  test.beforeEach(async ({ window }) => {
    await waitForAppReady(window)
  })

  // Skip: Streamdown resets source positions for code blocks
  // This test would require Streamdown to preserve cumulative offsets
  test.skip('fenced code block - click on code content', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    await editor.setContent(`\`\`\`javascript
const x = 1
\`\`\``)
    await window.waitForTimeout(500)

    // Use wildcard selector for code block content
    await preview.clickOnTextAtOffset('*', 'const', 0)
    await window.waitForTimeout(200)

    const pos = await editor.getCursorLineColumn()
    expect(pos.line).toBe(2)
    expect(pos.column).toBe(1) // Start of code line
  })
})

test.describe('Multi-line Content Click Positioning', () => {
  test.beforeEach(async ({ window }) => {
    await waitForAppReady(window)
  })

  // Skip: Streamdown resets source positions to 0 for each block element
  // Multi-line cursor sync requires Streamdown to preserve cumulative offsets
  test.skip('click on second paragraph', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    await editor.setContent(`First paragraph

Second paragraph`)
    await window.waitForTimeout(500)

    // Click on "Second" in the second paragraph
    await preview.clickOnTextAtOffset('p', 'Second', 0)
    await window.waitForTimeout(200)

    const pos = await editor.getCursorLineColumn()
    expect(pos.line).toBe(3)
    expect(pos.column).toBe(1)
  })

  // Skip: Streamdown resets source positions
  test.skip('click on heading after paragraph', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    await editor.setContent(`First paragraph

## Heading`)
    await window.waitForTimeout(500)

    await preview.clickOnTextAtOffset('h2', 'Heading', 0)
    await window.waitForTimeout(200)

    const pos = await editor.getCursorLineColumn()
    expect(pos.line).toBe(3)
    expect(pos.column).toBe(4) // After "## "
  })

  // Skip: Streamdown resets source positions
  test.skip('click on list item after paragraph', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    await editor.setContent(`Intro paragraph

- First item
- Second item`)
    await window.waitForTimeout(500)

    await preview.clickOnTextAtOffset('li', 'Second', 0)
    await window.waitForTimeout(200)

    const pos = await editor.getCursorLineColumn()
    expect(pos.line).toBe(4)
    expect(pos.column).toBe(3) // After "- "
  })
})

test.describe('Cursor Movement Verification', () => {
  test.beforeEach(async ({ window }) => {
    await waitForAppReady(window)
  })

  test('arrow keys work after preview click', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    await editor.setContent('Hello world')
    await window.waitForTimeout(500)

    await preview.clickOnTextAtOffset('p', 'world', 0)
    await window.waitForTimeout(200)

    const initial = await editor.getCursorLineColumn()

    await window.keyboard.press('ArrowRight')
    await window.waitForTimeout(100)

    const after = await editor.getCursorLineColumn()
    expect(after.column).toBe(initial.column + 1)
  })

  test('ArrowLeft moves cursor left after preview click', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    await editor.setContent('Hello world')
    await window.waitForTimeout(500)

    await preview.clickOnTextAtOffset('p', 'world', 0)
    await window.waitForTimeout(200)

    const initial = await editor.getCursorLineColumn()

    await window.keyboard.press('ArrowLeft')
    await window.waitForTimeout(100)

    const after = await editor.getCursorLineColumn()
    expect(after.column).toBe(initial.column - 1)
  })

  test('Shift+ArrowRight creates selection from click position', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    await editor.setContent('Hello world')
    await window.waitForTimeout(500)

    await preview.clickOnTextAtOffset('p', 'world', 0)
    await window.waitForTimeout(200)

    // Select "world"
    for (let i = 0; i < 5; i++) {
      await window.keyboard.press('Shift+ArrowRight')
    }
    await window.waitForTimeout(100)

    const selection = await editor.getSelection()
    expect(selection).toBe('world')
  })

  test('Home key goes to line start after click', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    await editor.setContent('Hello world')
    await window.waitForTimeout(500)

    await preview.clickOnTextAtOffset('p', 'world', 2)
    await window.waitForTimeout(200)

    await window.keyboard.press('Home')
    await window.waitForTimeout(100)

    const pos = await editor.getCursorLineColumn()
    expect(pos.column).toBe(1)
  })

  test('End key goes to line end after click', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    await editor.setContent('Hello world')
    await window.waitForTimeout(500)

    await preview.clickOnTextAtOffset('p', 'Hello', 0)
    await window.waitForTimeout(200)

    await window.keyboard.press('End')
    await window.waitForTimeout(100)

    const pos = await editor.getCursorLineColumn()
    expect(pos.column).toBe(12) // After "Hello world"
  })

  test('Shift+End selects to end of line', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    await editor.setContent('Hello world test')
    await window.waitForTimeout(500)

    await preview.clickOnTextAtOffset('p', 'world', 0)
    await window.waitForTimeout(200)

    await window.keyboard.press('Shift+End')
    await window.waitForTimeout(100)

    const selection = await editor.getSelection()
    expect(selection).toBe('world test')
  })

  test('Shift+Home selects to start of line', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    await editor.setContent('Hello world test')
    await window.waitForTimeout(500)

    await preview.clickOnTextAtOffset('p', 'test', 0)
    await window.waitForTimeout(200)

    await window.keyboard.press('Shift+Home')
    await window.waitForTimeout(100)

    const selection = await editor.getSelection()
    expect(selection).toBe('Hello world ')
  })
})

test.describe('Edge Cases', () => {
  test.beforeEach(async ({ window }) => {
    await waitForAppReady(window)
  })

  test('single character paragraph', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    await editor.setContent('X')
    await window.waitForTimeout(500)

    await preview.clickOnTextAtOffset('p', 'X', 0)
    await window.waitForTimeout(200)

    const pos = await editor.getCursorLineColumn()
    expect(pos.line).toBe(1)
    expect(pos.column).toBe(1)
  })

  test('click at end of single character', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    await editor.setContent('X')
    await window.waitForTimeout(500)

    await preview.clickOnTextAtOffset('p', 'X', 1)
    await window.waitForTimeout(200)

    const pos = await editor.getCursorLineColumn()
    expect(pos.line).toBe(1)
    expect(pos.column).toBe(2) // After "X"
  })

  test('whitespace-heavy content', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    await editor.setContent('Word   with   spaces')
    await window.waitForTimeout(500)

    await preview.clickOnTextAtOffset('p', 'spaces', 0)
    await window.waitForTimeout(200)

    const pos = await editor.getCursorLineColumn()
    // Position should account for all characters including extra spaces
    expect(pos.column).toBeGreaterThan(10)
  })

  test('mixed formatting in paragraph', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    await editor.setContent('Normal **bold** and *italic* text')
    await window.waitForTimeout(500)

    // Click on "text" at the end
    await preview.clickOnTextAtOffset('p', 'text', 0)
    await window.waitForTimeout(200)

    const pos = await editor.getCursorLineColumn()
    // Should account for all the formatting characters: ** ** * *
    expect(pos.column).toBe(30) // After "Normal **bold** and *italic* "
  })
})
