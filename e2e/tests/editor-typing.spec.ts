import { test, expect, waitForMonacoReady } from '../fixtures'
import { EditorHelpers } from '../helpers/editor-helpers'

test.describe('Editor Typing Behavior', () => {
  test.beforeEach(async ({ window }) => {
    // Wait for app to load
    await window.waitForLoadState('domcontentloaded')
    await window.waitForTimeout(1000)

    // Check if Monaco editor is already visible (session restored with tabs)
    const editorVisible = await window.$('.monaco-editor')
    if (!editorVisible) {
      // No tabs open, create a new file with Ctrl+N
      await window.keyboard.press('Control+n')
      await window.waitForTimeout(1000)
    }

    await waitForMonacoReady(window)
  })

  test('text should appear in correct left-to-right order', async ({ window }) => {
    const editor = new EditorHelpers(window)

    // Clear editor
    await editor.setContent('')
    await editor.focus()
    await window.keyboard.press('Control+Home')
    await window.waitForTimeout(200)

    // Type "Hello" character by character
    await window.keyboard.type('Hello', { delay: 100 })
    await window.waitForTimeout(500)

    // Verify content is in correct order
    const content = await editor.getFullContent()
    expect(content).toBe('Hello')

    // Verify cursor is after the last character typed
    const pos = await editor.getCursorLineColumn()
    expect(pos.line).toBe(1)
    expect(pos.column).toBe(6) // After 'o' in "Hello"
  })

  test('Enter key should leave cursor on the new line', async ({ window }) => {
    const editor = new EditorHelpers(window)

    // Set initial content
    await editor.setContent('Line 1')
    await editor.focus()
    await window.keyboard.press('End')
    await window.waitForTimeout(200)

    // Press Enter
    await window.keyboard.press('Enter')
    await window.waitForTimeout(500)

    // Verify cursor is on line 2 (not jumped back to line 1)
    const pos = await editor.getCursorLineColumn()
    expect(pos.line).toBe(2)

    // Type on the new line
    await window.keyboard.type('Line 2', { delay: 50 })
    await window.waitForTimeout(500)

    // Verify content is correct (trim trailing whitespace from auto-indent)
    const content = await editor.getFullContent()
    const lines = content.split('\n').map(l => l.trimEnd())
    expect(lines[0]).toBe('Line 1')
    expect(lines[1]).toBe('Line 2')
  })

  test('typing after Enter should maintain forward direction', async ({ window }) => {
    const editor = new EditorHelpers(window)

    // Set initial content
    await editor.setContent('Hello')
    await editor.focus()
    await window.keyboard.press('End')
    await window.waitForTimeout(200)

    // Press Enter to create new line
    await window.keyboard.press('Enter')
    await window.waitForTimeout(300)

    // Type "World" on the new line
    await window.keyboard.type('World', { delay: 100 })
    await window.waitForTimeout(500)

    // Verify content - "World" should be in correct order (trim trailing whitespace from auto-indent)
    const content = await editor.getFullContent()
    const lines = content.split('\n').map(l => l.trimEnd())
    expect(lines[0]).toBe('Hello')
    expect(lines[1]).toBe('World')

    // Verify cursor is on line 2 past "World"
    const pos = await editor.getCursorLineColumn()
    expect(pos.line).toBe(2)
  })

  test('rapid typing should not scramble characters', async ({ window }) => {
    const editor = new EditorHelpers(window)

    // Clear editor
    await editor.setContent('')
    await editor.focus()
    await window.keyboard.press('Control+Home')
    await window.waitForTimeout(200)

    // Type rapidly without delay between keystrokes
    await window.keyboard.type('The quick brown fox')
    await window.waitForTimeout(500)

    // Verify content is in correct order
    const content = await editor.getFullContent()
    expect(content).toBe('The quick brown fox')
  })

  test('multiple Enter presses should create correct newlines', async ({ window }) => {
    const editor = new EditorHelpers(window)

    // Start fresh
    await editor.setContent('Start')
    await editor.focus()
    await window.keyboard.press('End')
    await window.waitForTimeout(200)

    // Press Enter twice
    await window.keyboard.press('Enter')
    await window.waitForTimeout(200)
    await window.keyboard.press('Enter')
    await window.waitForTimeout(200)

    // Type on line 3
    await window.keyboard.type('End', { delay: 50 })
    await window.waitForTimeout(500)

    // Verify content (trim trailing whitespace from auto-indent)
    const content = await editor.getFullContent()
    const lines = content.split('\n').map(l => l.trimEnd())
    expect(lines[0]).toBe('Start')
    expect(lines[1]).toBe('')
    expect(lines[2]).toBe('End')

    // Verify cursor is on line 3
    const pos = await editor.getCursorLineColumn()
    expect(pos.line).toBe(3)
  })
})
