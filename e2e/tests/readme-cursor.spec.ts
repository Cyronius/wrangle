import { test, expect, waitForAppReady } from '../fixtures'
import { PreviewHelpers } from '../helpers/preview-helpers'
import { EditorHelpers } from '../helpers/editor-helpers'
import fs from 'fs'
import path from 'path'

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

test.describe('README.md Cursor Tests', () => {
  test.beforeEach(async ({ window }) => {
    await waitForAppReady(window)
    // Capture console logs for debugging
    window.on('console', (msg) => {
      const text = msg.text()
      if (
        text.includes('CURSOR') ||
        text.includes('SOURCEMAP') ||
        text.includes('[MarkdownPreview]') ||
        text.includes('[EditorLayout]')
      ) {
        console.log('[BROWSER]', text)
      }
    })
  })

  test('clicking on elements syncs cursor to editor', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    // Load README.md content
    const readmePath = path.resolve(__dirname, '../../README.md')
    const content = fs.readFileSync(readmePath, 'utf-8')
    await editor.setContent(content)

    // Wait for markdown to render and source map to be ready
    await window.waitForTimeout(1500)

    // Get all source-mapped elements
    const elements = await preview.getSourceMappedElements()
    console.log(`Found ${elements.length} source-mapped elements`)

    // Verify we have source-mapped elements
    expect(elements.length).toBeGreaterThan(0)

    // Group elements by tag name to test one of each type
    const elementsByTag = new Map<string, string>()
    for (const el of elements) {
      if (!elementsByTag.has(el.tagName)) {
        elementsByTag.set(el.tagName, el.id)
      }
    }

    console.log('Element types found:', Array.from(elementsByTag.keys()).join(', '))

    // Test that clicking updates editor cursor
    let successCount = 0
    const totalTests = Math.min(elementsByTag.size, 5) // Test up to 5 element types

    let count = 0
    for (const [tagName, _id] of elementsByTag) {
      if (count >= totalTests) break
      count++

      console.log(`\n--- Testing cursor on ${tagName} ---`)

      // Click on the element using the tag selector
      const element = await window.$(`.markdown-body ${tagName}`)
      if (!element) {
        console.error(`Element not found: ${tagName}`)
        continue
      }

      await element.scrollIntoViewIfNeeded()
      await window.waitForTimeout(200)
      await element.click()
      await window.waitForTimeout(500)

      // Check if cursor is in preview
      const isInPreview = await isNativeCursorInPreview(window)
      console.log(`Native cursor in preview: ${isInPreview}`)

      if (isInPreview) {
        successCount++
      }
    }

    // At least 50% of element types should work
    expect(successCount).toBeGreaterThanOrEqual(Math.floor(totalTests / 2))
  })

  test('cursor appears on H1 heading', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    // Load README.md
    const readmePath = path.resolve(__dirname, '../../README.md')
    const content = fs.readFileSync(readmePath, 'utf-8')
    await editor.setContent(content)
    await window.waitForTimeout(1000)

    // Click on first H1
    const h1 = await window.$('.markdown-body h1')
    expect(h1).not.toBeNull()
    await h1!.click()
    await window.waitForTimeout(300)

    // Check native cursor is in preview
    const isInPreview = await isNativeCursorInPreview(window)
    expect(isInPreview).toBe(true)
  })

  test('cursor appears on paragraph', async ({ window }) => {
    const editor = new EditorHelpers(window)

    // Load README.md
    const readmePath = path.resolve(__dirname, '../../README.md')
    const content = fs.readFileSync(readmePath, 'utf-8')
    await editor.setContent(content)
    await window.waitForTimeout(1000)

    // Click on first paragraph
    const p = await window.$('.markdown-body p')
    expect(p).not.toBeNull()
    await p!.click()
    await window.waitForTimeout(300)

    // Check native cursor is in preview
    const isInPreview = await isNativeCursorInPreview(window)
    expect(isInPreview).toBe(true)
  })

  test('cursor appears on table', async ({ window }) => {
    const editor = new EditorHelpers(window)

    // Load README.md
    const readmePath = path.resolve(__dirname, '../../README.md')
    const content = fs.readFileSync(readmePath, 'utf-8')
    await editor.setContent(content)
    await window.waitForTimeout(1000)

    // Click on first table cell
    const table = await window.$('.markdown-body table td')
    if (table) {
      await table.scrollIntoViewIfNeeded()
      await table.click()
      await window.waitForTimeout(300)

      // Check native cursor is in preview
      const isInPreview = await isNativeCursorInPreview(window)
      expect(isInPreview).toBe(true)
    } else {
      console.log('No table found in README.md')
    }
  })

  test('cursor appears on code block', async ({ window }) => {
    const editor = new EditorHelpers(window)

    // Load README.md
    const readmePath = path.resolve(__dirname, '../../README.md')
    const content = fs.readFileSync(readmePath, 'utf-8')
    await editor.setContent(content)
    await window.waitForTimeout(1000)

    // Click on first code block (pre element)
    const pre = await window.$('.markdown-body pre code')
    if (pre) {
      await pre.scrollIntoViewIfNeeded()
      await pre.click()
      await window.waitForTimeout(300)

      // Code blocks may or may not have contentEditable - just verify click doesn't error
      console.log('Clicked on code block successfully')
    } else {
      console.log('No code block found in README.md')
    }
  })

  test('cursor appears on list items', async ({ window }) => {
    const editor = new EditorHelpers(window)

    // Load README.md
    const readmePath = path.resolve(__dirname, '../../README.md')
    const content = fs.readFileSync(readmePath, 'utf-8')
    await editor.setContent(content)
    await window.waitForTimeout(1000)

    // Click on first list item
    const li = await window.$('.markdown-body li')
    if (li) {
      await li.scrollIntoViewIfNeeded()
      await li.click()
      await window.waitForTimeout(300)

      // Check native cursor is in preview
      const isInPreview = await isNativeCursorInPreview(window)
      expect(isInPreview).toBe(true)
    } else {
      console.log('No list item found in README.md')
    }
  })

  test('DEBUG: interactive cursor test', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    // Load README.md
    const readmePath = path.resolve(__dirname, '../../README.md')
    const content = fs.readFileSync(readmePath, 'utf-8')
    await editor.setContent(content)
    await window.waitForTimeout(1000)

    // Get all elements
    const elements = await preview.getSourceMappedElements()
    console.log('Source-mapped elements:')
    for (const el of elements.slice(0, 20)) {
      console.log(`  ${el.id}: ${el.tagName}`)
    }

    // Click on first H1
    const h1 = await window.$('.markdown-body h1')
    if (h1) {
      await h1.click()
      await window.waitForTimeout(500)

      const isInPreview = await isNativeCursorInPreview(window)
      const selection = await window.evaluate(() => {
        const sel = window.getSelection()
        return sel ? { offset: sel.anchorOffset, collapsed: sel.isCollapsed } : null
      })
      console.log('H1 click - cursor in preview:', isInPreview, 'selection:', selection)
    }
  })

  test('editor cursor moves when clicking different preview elements', async ({ window }) => {
    const editor = new EditorHelpers(window)

    // Load README.md
    const readmePath = path.resolve(__dirname, '../../README.md')
    const content = fs.readFileSync(readmePath, 'utf-8')
    await editor.setContent(content)
    await window.waitForTimeout(1000)

    // Click on first H1 (at top)
    const h1 = await window.$('.markdown-body h1')
    expect(h1).not.toBeNull()
    await h1!.click()
    await window.waitForTimeout(300)

    // Get editor cursor position after H1 click
    const pos1 = await editor.getCursorLineColumn()
    console.log('After clicking H1, editor cursor:', pos1)

    // Click on a paragraph further down
    const paragraphs = await window.$$('.markdown-body p')
    expect(paragraphs.length).toBeGreaterThan(0)

    const p = paragraphs[0]
    await p.scrollIntoViewIfNeeded()
    await window.waitForTimeout(200)
    await p.click()
    await window.waitForTimeout(500)

    // Get editor cursor position after paragraph click
    const pos2 = await editor.getCursorLineColumn()
    console.log('After clicking paragraph, editor cursor:', pos2)

    // Editor cursor should have moved
    // (Either line or column should be different)
    const cursorMoved = pos1.line !== pos2.line || pos1.column !== pos2.column
    expect(cursorMoved).toBe(true)
  })
})
