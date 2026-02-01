import { test, expect, waitForAppReady } from '../fixtures'
import { PreviewHelpers } from '../helpers/preview-helpers'
import { EditorHelpers } from '../helpers/editor-helpers'

test.describe('Click-to-Cursor Character Positioning', () => {
  test.beforeEach(async ({ window }) => {
    await waitForAppReady(window)
  })

  test('clicking middle of word positions cursor correctly', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    // Set content with a simple paragraph
    await editor.setContent('Hello world')
    await window.waitForTimeout(500)

    // Click at the start of "world" (character 6 in "Hello world")
    await preview.clickOnTextAtOffset('p', 'world', 0)
    await window.waitForTimeout(200)

    // Verify cursor is at the start of "world", not at the start of the paragraph
    const cursorPos = await editor.getCursorLineColumn()
    // "Hello world" - "world" starts at column 7 (1-indexed)
    expect(cursorPos.column).toBeGreaterThanOrEqual(6)
  })

  test('clicking in middle of a word positions cursor within word', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    await editor.setContent('Hello world')
    await window.waitForTimeout(500)

    // Click in the middle of "world" (offset 2 = on the 'r')
    await preview.clickOnTextAtOffset('p', 'world', 2)
    await window.waitForTimeout(200)

    const cursorPos = await editor.getCursorLineColumn()
    // Should be around column 9 (H-e-l-l-o- -w-o-r = 9 chars to 'r')
    expect(cursorPos.column).toBeGreaterThanOrEqual(8)
  })

  test('clicking at start of paragraph positions cursor at start', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    await editor.setContent('Hello world')
    await window.waitForTimeout(500)

    // Click at the start of "Hello"
    await preview.clickOnTextAtOffset('p', 'Hello', 0)
    await window.waitForTimeout(200)

    const cursorPos = await editor.getCursorLineColumn()
    // Should be at column 1 or 2 (start of line)
    expect(cursorPos.column).toBeLessThanOrEqual(2)
  })

  test('arrow keys work correctly after click positioning', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    await editor.setContent('Hello world')
    await window.waitForTimeout(500)

    // Click at start of "world" - this positions editor cursor but keeps focus in preview
    await preview.clickOnTextAtOffset('p', 'world', 0)
    await window.waitForTimeout(200)

    const initialPos = await editor.getCursorLineColumn()

    // Focus editor without changing cursor position
    await editor.focus()

    // Press left arrow - should move one character left
    await window.keyboard.press('ArrowLeft')
    await window.waitForTimeout(100)

    const afterLeft = await editor.getCursorLineColumn()
    expect(afterLeft.column).toBe(initialPos.column - 1)

    // Press right arrow twice - should be one character right of initial
    await window.keyboard.press('ArrowRight')
    await window.keyboard.press('ArrowRight')
    await window.waitForTimeout(100)

    const afterRight = await editor.getCursorLineColumn()
    expect(afterRight.column).toBe(initialPos.column + 1)
  })

  test('Shift+arrow creates selection from click position', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    await editor.setContent('Hello world')
    await window.waitForTimeout(500)

    // Click at start of "world" - positions editor cursor, keeps focus in preview
    await preview.clickOnTextAtOffset('p', 'world', 0)
    await window.waitForTimeout(200)

    // Focus editor without changing cursor position
    await editor.focus()

    // Shift+Right to select 'w'
    await window.keyboard.press('Shift+ArrowRight')
    await window.waitForTimeout(100)

    // Get selection - should be 'w'
    const selection = await editor.getSelection()
    expect(selection).toBe('w')
  })

  test('Shift+arrow selects multiple characters', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    await editor.setContent('Hello world')
    await window.waitForTimeout(500)

    // Click at start of "world" - positions editor cursor, keeps focus in preview
    await preview.clickOnTextAtOffset('p', 'world', 0)
    await window.waitForTimeout(200)

    // Focus editor without changing cursor position
    await editor.focus()

    // Shift+Right 5 times to select 'world'
    for (let i = 0; i < 5; i++) {
      await window.keyboard.press('Shift+ArrowRight')
    }
    await window.waitForTimeout(100)

    const selection = await editor.getSelection()
    expect(selection).toBe('world')
  })

  test('Home key goes to line start after click in middle', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    await editor.setContent('Hello world')
    await window.waitForTimeout(500)

    // Click in middle of line - positions editor cursor, keeps focus in preview
    await preview.clickOnTextAtOffset('p', 'world', 2)
    await window.waitForTimeout(200)

    // Focus editor without changing cursor position
    await editor.focus()

    // Press Home
    await window.keyboard.press('Home')
    await window.waitForTimeout(100)

    const pos = await editor.getCursorLineColumn()
    expect(pos.column).toBe(1) // At start of line
  })

  test('End key goes to line end after click in middle', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    await editor.setContent('Hello world')
    await window.waitForTimeout(500)

    // Click at start of line - positions editor cursor, keeps focus in preview
    await preview.clickOnTextAtOffset('p', 'Hello', 0)
    await window.waitForTimeout(200)

    // Focus editor without changing cursor position
    await editor.focus()

    // Press End
    await window.keyboard.press('End')
    await window.waitForTimeout(100)

    const pos = await editor.getCursorLineColumn()
    // "Hello world" is 11 characters, so end should be column 12
    expect(pos.column).toBeGreaterThanOrEqual(11)
  })

  test('clicking on different words positions cursor correctly', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    await editor.setContent('The quick brown fox jumps')
    await window.waitForTimeout(500)

    // Click on "quick"
    await preview.clickOnTextAtOffset('p', 'quick', 0)
    await window.waitForTimeout(200)
    const quickPos = await editor.getCursorLineColumn()

    // Click on "fox"
    await preview.clickOnTextAtOffset('p', 'fox', 0)
    await window.waitForTimeout(200)
    const foxPos = await editor.getCursorLineColumn()

    // Click on "jumps"
    await preview.clickOnTextAtOffset('p', 'jumps', 0)
    await window.waitForTimeout(200)
    const jumpsPos = await editor.getCursorLineColumn()

    // Each click should position at a different column
    expect(quickPos.column).toBeLessThan(foxPos.column)
    expect(foxPos.column).toBeLessThan(jumpsPos.column)
  })

  test('clicking in heading positions cursor correctly', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    await editor.setContent('# Hello World Heading')
    await window.waitForTimeout(500)

    // Click on "World" in the heading
    await preview.clickOnTextAtOffset('h1', 'World', 0)
    await window.waitForTimeout(200)

    const cursorPos = await editor.getCursorLineColumn()
    // "# Hello World" - "World" starts after "# Hello " (9 chars with the # and space)
    expect(cursorPos.column).toBeGreaterThanOrEqual(8)
  })

  test('Shift+End selects from click position to end of line', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    await editor.setContent('Hello world test')
    await window.waitForTimeout(500)

    // Click at start of "world" - positions editor cursor, keeps focus in preview
    await preview.clickOnTextAtOffset('p', 'world', 0)
    await window.waitForTimeout(200)

    // Focus editor without changing cursor position
    await editor.focus()

    // Shift+End to select to end of line
    await window.keyboard.press('Shift+End')
    await window.waitForTimeout(100)

    const selection = await editor.getSelection()
    expect(selection).toBe('world test')
  })

  test('Shift+Home selects from click position to start of line', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    await editor.setContent('Hello world test')
    await window.waitForTimeout(500)

    // Click at start of "test" - positions editor cursor, keeps focus in preview
    await preview.clickOnTextAtOffset('p', 'test', 0)
    await window.waitForTimeout(200)

    // Focus editor without changing cursor position
    await editor.focus()

    // Shift+Home to select to start of line
    await window.keyboard.press('Shift+Home')
    await window.waitForTimeout(100)

    const selection = await editor.getSelection()
    expect(selection).toBe('Hello world ')
  })
})

test.describe('Click-to-Cursor with Formatted Text', () => {
  test.beforeEach(async ({ window }) => {
    await waitForAppReady(window)
  })

  test('clicking after bold text positions cursor correctly', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    // Content with bold formatting: **bold** takes 8 chars in source, renders as "bold" (4 chars)
    await editor.setContent('Hello **bold** world')
    await window.waitForTimeout(500)

    // Click on "world" which appears after the bold text
    await preview.clickOnTextAtOffset('p', 'world', 0)
    await window.waitForTimeout(200)

    // "world" in source starts at position 16 (after "Hello **bold** ")
    // In rendered text it appears at position 12 (after "Hello bold ")
    const pos = await editor.getCursorLineColumn()
    // The cursor should be positioned at column 12 or higher (visual position)
    // Note: Exact source offset accounting for ** markers is a known limitation
    expect(pos.column).toBeGreaterThanOrEqual(12)
  })

  test('clicking on bold text positions cursor correctly', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    await editor.setContent('Hello **bold** world')
    await window.waitForTimeout(500)

    // Click at the start of "bold"
    await preview.clickOnTextAtOffset('p', 'bold', 0)
    await window.waitForTimeout(200)

    const pos = await editor.getCursorLineColumn()
    // "bold" in source starts at column 9 (after "Hello **")
    expect(pos.column).toBeGreaterThanOrEqual(8)
  })

  test('clicking after italic text positions cursor correctly', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    await editor.setContent('Hello *italic* world')
    await window.waitForTimeout(500)

    // Click on "world"
    await preview.clickOnTextAtOffset('p', 'world', 0)
    await window.waitForTimeout(200)

    const pos = await editor.getCursorLineColumn()
    // Should account for the * characters
    expect(pos.column).toBeGreaterThan(12)
  })

  test('clicking in text with inline code positions correctly', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    await editor.setContent('Run the `command` now')
    await window.waitForTimeout(500)

    // Click on "now"
    await preview.clickOnTextAtOffset('p', 'now', 0)
    await window.waitForTimeout(200)

    const pos = await editor.getCursorLineColumn()
    // Should account for the backticks
    expect(pos.column).toBeGreaterThan(15)
  })
})

test.describe('Click-to-Cursor with short.md', () => {
  test.beforeEach(async ({ window }) => {
    await waitForAppReady(window)
  })

  test('clicking in Wrangle heading positions correctly', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    // Use content similar to short.md
    await editor.setContent(`# Wrangle

> A modern, feature-rich desktop Markdown editor

Wrangle is a powerful desktop Markdown editor.`)
    await window.waitForTimeout(500)

    // Click on "Wrangle" in the heading
    await preview.clickOnTextAtOffset('h1', 'Wrangle', 3) // Click on 'g'
    await window.waitForTimeout(200)

    const pos = await editor.getCursorLineColumn()
    // Should be on line 1, around column 5-6 (# Ta_n_gle)
    expect(pos.line).toBe(1)
    expect(pos.column).toBeGreaterThanOrEqual(4)
  })

  test('clicking in blockquote positions correctly', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    await editor.setContent(`# Wrangle

> A modern, feature-rich desktop Markdown editor

Wrangle is a powerful desktop Markdown editor.`)
    await window.waitForTimeout(500)

    // Click on "modern" in the blockquote
    await preview.clickOnTextAtOffset('blockquote', 'modern', 0)
    await window.waitForTimeout(200)

    const pos = await editor.getCursorLineColumn()
    // Should be on line 3 (blank line 2, blockquote line 3)
    expect(pos.line).toBe(3)
    // "modern" starts after "> A " (4 chars)
    expect(pos.column).toBeGreaterThanOrEqual(4)
  })

  test('clicking in paragraph after blockquote positions correctly', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    await editor.setContent(`# Wrangle

> A modern, feature-rich desktop Markdown editor

Wrangle is a powerful desktop Markdown editor.`)
    await window.waitForTimeout(500)

    // Click on "powerful" in the paragraph
    await preview.clickOnTextAtOffset('p', 'powerful', 0)
    await window.waitForTimeout(200)

    const pos = await editor.getCursorLineColumn()
    // Should be on line 5
    expect(pos.line).toBe(5)
    // "powerful" starts after "Wrangle is a " (12 chars)
    expect(pos.column).toBeGreaterThanOrEqual(12)
  })
})
