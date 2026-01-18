import { test, expect, waitForAppReady } from '../fixtures'
import { PreviewHelpers } from '../helpers/preview-helpers'
import { EditorHelpers } from '../helpers/editor-helpers'

/**
 * Debug test to understand the exact issue with click-to-cursor positioning.
 */

// SKIP: Debug tests check exact column positions after bold text.
// Known limitation: source position calculation doesn't account for ** markers.
test.describe.skip('Click-to-Cursor Debug', () => {
  test.beforeEach(async ({ window }) => {
    await waitForAppReady(window)

    // Capture console logs from the browser
    window.on('console', msg => {
      if (msg.text().includes('[') && !msg.text().includes('Electron')) {
        console.log('[BROWSER]', msg.text())
      }
    })
  })

  test('debug list item click', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    // Simple test case: one list item with bold
    const content = `- **Monaco Editor** - The same powerful code editor`

    await editor.setContent(content)
    await window.waitForTimeout(1000)

    // Get info about the source-mapped element
    const sourceInfo = await window.evaluate(() => {
      const el = document.querySelector('[data-source-start]')
      if (!el) return null
      return {
        tagName: el.tagName,
        sourceId: el.getAttribute('data-source-start'),
        textContent: el.textContent,
        innerHTML: el.innerHTML.substring(0, 200)
      }
    })
    console.log('[TEST] Source element info:', sourceInfo)

    // Click on "same"
    await preview.clickOnTextAtOffset('li', 'same', 0)
    await window.waitForTimeout(500)

    const pos = await editor.getCursorLineColumn()
    console.log('[TEST] Final cursor position:', pos)

    // Raw: "- **Monaco Editor** - The same powerful code editor"
    // "same" starts at position 27 (after "- **Monaco Editor** - The ")
    // Clicking on "s" places cursor BEFORE it, at column 27
    expect(pos.column).toBe(27)
  })

  test('debug single paragraph with bold', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    // Simple paragraph with bold
    const content = `Hello **bold** world`

    await editor.setContent(content)
    await window.waitForTimeout(1000)

    // Get info about the source-mapped element
    const sourceInfo = await window.evaluate(() => {
      const el = document.querySelector('[data-source-start]')
      if (!el) return null
      return {
        tagName: el.tagName,
        sourceId: el.getAttribute('data-source-start'),
        textContent: el.textContent
      }
    })
    console.log('[TEST] Source element info:', sourceInfo)

    // Click on "world"
    await preview.clickOnTextAtOffset('p', 'world', 0)
    await window.waitForTimeout(500)

    const pos = await editor.getCursorLineColumn()
    console.log('[TEST] Final cursor position:', pos)

    // Raw: "Hello **bold** world"
    // "world" starts at position 15 (after "Hello **bold** ")
    // Column should be 16 (1-indexed)
    expect(pos.column).toBe(16)
  })
})
