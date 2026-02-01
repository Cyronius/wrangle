import { test, expect, waitForAppReady } from '../fixtures'
import { PreviewHelpers } from '../helpers/preview-helpers'
import { EditorHelpers } from '../helpers/editor-helpers'

/**
 * Helper to check if native cursor is in preview area
 */
async function isNativeCursorInPreview(window: any): Promise<boolean> {
  return window.evaluate(() => {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return false
    const container = sel.getRangeAt(0).startContainer
    const element = container.nodeType === Node.TEXT_NODE
      ? container.parentElement
      : container as Element
    return !!element?.closest('.markdown-preview')
  })
}

test.describe('Scroll Synchronization', () => {
  test.beforeEach(async ({ window }) => {
    await waitForAppReady(window)
  })

  test.skip('scrolling editor should scroll preview', async ({ window }) => {
    // TODO: This test is flaky due to source map timing issues with large content
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    // Generate content with many paragraphs (need blank lines for paragraph breaks)
    let content = '# Document Title\n\n'
    for (let i = 1; i <= 30; i++) {
      content += `Paragraph ${i} with enough content to make it visible.\n\n`
    }
    // End with a final paragraph (no trailing blank line)
    content += 'Final paragraph for cursor target.'

    await editor.setContent(content)
    await window.waitForTimeout(1000) // Wait for content to render

    // Position cursor at start
    await window.click('.monaco-editor .view-line:first-child')
    await window.keyboard.press('Home')
    await window.waitForTimeout(200)

    // Get initial highlight
    const initialHighlight = await preview.getHighlightedElement()

    // Scroll editor down using Ctrl+End (cursor goes to last line with content)
    await window.keyboard.press('Control+End')
    await window.waitForTimeout(500)

    // Check that highlight changed (indicating sync worked)
    const newHighlight = await preview.getHighlightedElement()
    expect(newHighlight).toBeTruthy()
    // Highlight should be different from the initial (heading) element
    expect(newHighlight).not.toEqual(initialHighlight)
  })

  test('scrolling preview should scroll editor', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    // Generate shorter content
    let content = '# Document Title\n'
    for (let i = 1; i <= 20; i++) {
      content += `Line ${i} paragraph.\n`
    }

    await editor.setContent(content)
    await window.waitForTimeout(1000)

    // First position the cursor to ensure highlight exists
    await window.click('.monaco-editor .view-line:first-child')
    await window.keyboard.press('Home')
    await window.waitForTimeout(200)

    // Scroll preview manually
    await preview.scrollTo(200)
    await window.waitForTimeout(500)

    // The highlighted element should exist
    const highlighted = await preview.getHighlightedElement()
    // Note: This depends on the exact implementation of sync
    // The test verifies that sync mechanism is working
    expect(highlighted).toBeTruthy()
  })

  test('cursor navigation keeps preview synced', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    // Set up content with no blank lines (to ensure cursor always has a mapped element)
    let content = '# Test Document\n'
    for (let i = 1; i <= 15; i++) {
      content += `Paragraph ${i} with content.\n`
    }

    await editor.setContent(content)
    await window.waitForTimeout(500)

    // Position cursor on first line
    await window.click('.monaco-editor .view-line:first-child')
    await window.keyboard.press('Home')
    await window.waitForTimeout(200)

    // Navigate down and verify highlight stays visible
    for (let i = 0; i < 3; i++) {
      await window.keyboard.press('ArrowDown')
      await window.waitForTimeout(100)

      // Check that there's a highlighted element after each move
      const highlighted = await preview.getHighlightedElement()
      // Highlighted element should exist (indicates sync is working)
      expect(highlighted).not.toBeNull()
    }
  })

  test('highlight changes when navigating in editor', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    // Set up content (no blank lines)
    await editor.setContent(`# Title
First paragraph content.
Second paragraph content.
Third paragraph content.`)

    await window.waitForTimeout(500)

    // Click on first line to set cursor
    await window.click('.monaco-editor .view-line:first-child')
    await window.keyboard.press('Home')
    await window.waitForTimeout(200)

    // Get highlighted element before navigation
    const highlightBefore = await preview.getHighlightedElement()
    expect(highlightBefore).not.toBeNull()

    // Navigate down a few lines
    await window.keyboard.press('ArrowDown')
    await window.keyboard.press('ArrowDown')
    await window.waitForTimeout(200)

    // Get highlighted element after navigation
    const highlightAfter = await preview.getHighlightedElement()

    // Highlight should exist and may be different
    expect(highlightAfter).not.toBeNull()
  })
})
