import { test, expect, waitForAppReady } from '../fixtures'
import { PreviewHelpers } from '../helpers/preview-helpers'
import { EditorHelpers } from '../helpers/editor-helpers'

test.describe('Preview Pseudo-Cursor', () => {
  test.beforeEach(async ({ window }) => {
    await waitForAppReady(window)
  })

  test('should display pseudo-cursor when cursor is in editor', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    // Type content in editor to have something to show cursor on
    await editor.setContent('# Hello World\n\nThis is a paragraph.')

    // Wait for preview to render
    await window.waitForTimeout(500)

    // Click on first line in editor to position cursor
    await window.click('.monaco-editor .view-line:first-child')
    await window.keyboard.press('Home')
    await window.waitForTimeout(200)

    // Pseudo-cursor should be visible (when sync is enabled)
    const cursorVisible = await preview.isPseudoCursorVisible()
    expect(cursorVisible).toBe(true)
  })

  test('pseudo-cursor should match clicked element position', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    // Create content with multiple elements
    await editor.setContent(`# Heading

First paragraph with some text.

Second paragraph with different text.

## Subheading

Another paragraph here.`)

    // Wait for preview to render
    await window.waitForTimeout(500)

    // Click on the first paragraph in preview
    await preview.clickOnElement('p:first-of-type')

    // Wait for cursor update
    await window.waitForTimeout(200)

    // Get pseudo-cursor position
    const cursorPos = await preview.getPseudoCursorPosition()
    expect(cursorPos).not.toBeNull()

    // Verify cursor is within reasonable bounds of the clicked element
    if (cursorPos) {
      const highlightedId = await preview.getHighlightedElement()
      if (highlightedId) {
        const elementInfo = await preview.getElementBySourceId(highlightedId)
        if (elementInfo) {
          // Cursor should be near the element
          expect(cursorPos.top).toBeGreaterThanOrEqual(elementInfo.bounds.y - 100)
          expect(cursorPos.top).toBeLessThanOrEqual(
            elementInfo.bounds.y + elementInfo.bounds.height + 100
          )
        }
      }
    }
  })

  test('pseudo-cursor should remain visible and not flicker', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    // Set up content
    await editor.setContent('# Test\n\nParagraph content for cursor testing.')
    await window.waitForTimeout(500)

    // Click on first line in editor and position cursor
    await window.click('.monaco-editor .view-line:first-child')
    await window.keyboard.press('Home')
    await window.waitForTimeout(200)

    // Verify cursor stability over 2 seconds (checking every 100ms)
    const stability = await preview.verifyPseudoCursorStability(2000, 100)

    expect(stability.stable).toBe(true)
    if (!stability.stable) {
      console.error(`Pseudo-cursor disappeared at ${stability.missingAt}ms`)
    }
  })

  test('pseudo-cursor should update when editor cursor moves', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    // Set up content with multiple lines (no blank lines to ensure cursor stays on mapped elements)
    await editor.setContent(`# Line 1
Paragraph on line 2.
Another paragraph on line 3.
Yet another on line 4.`)

    await window.waitForTimeout(500)

    // Get initial cursor position - click on first line (heading)
    await window.click('.monaco-editor .view-line:first-child')
    await window.keyboard.press('Home')
    await window.waitForTimeout(200)
    const initialPos = await preview.getPseudoCursorPosition()
    expect(initialPos).not.toBeNull()

    // Move cursor down to a different line (paragraph)
    await window.keyboard.press('ArrowDown')
    await window.waitForTimeout(200)

    // Get new cursor position
    const newPos = await preview.getPseudoCursorPosition()

    // Positions should be different (cursor moved to different element)
    expect(newPos).not.toBeNull()
    if (initialPos && newPos) {
      // The cursor should have moved (different top position)
      expect(newPos.top).not.toEqual(initialPos.top)
    }
  })

  test('clicking in preview should position cursor at clicked location', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    // Set up content
    await editor.setContent(`# Test Document

First paragraph of content.

Second paragraph of content.

Third paragraph of content.`)

    await window.waitForTimeout(500)

    // Get all source-mapped elements
    const elements = await preview.getSourceMappedElements()
    expect(elements.length).toBeGreaterThan(0)

    // Click on a specific paragraph
    const secondPara = await window.$('.markdown-body p:nth-of-type(2)')
    if (secondPara) {
      await secondPara.click()
      await window.waitForTimeout(200)

      // Cursor should be visible and positioned
      const cursorPos = await preview.getPseudoCursorPosition()
      expect(cursorPos).not.toBeNull()
    }
  })

  test('clicking in preview should NOT cause cursor to flicker or disappear', async ({
    window
  }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    // Set up content with multiple paragraphs
    await editor.setContent(`# Main Heading

This is the first paragraph with some content.

This is the second paragraph with different content.

This is the third paragraph with more content.

## Subheading

Final paragraph.`)

    await window.waitForTimeout(500)

    // Click on the second paragraph in preview
    await preview.clickOnElement('p:nth-of-type(2)')
    await window.waitForTimeout(50)

    // Immediately start checking for cursor stability
    // This is the key test for the race condition bug
    const stability = await preview.verifyPseudoCursorStability(1500, 50)

    expect(stability.stable).toBe(true)
    if (!stability.stable) {
      console.error(
        `REGRESSION: Pseudo-cursor flickered/disappeared at ${stability.missingAt}ms after clicking in preview`
      )
    }
  })
})
