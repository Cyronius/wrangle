// Traces: MDP-001 (canonical spec: specs/markdown-preview/spec.md)
import { test, expect, waitForAppReady } from '../../fixtures'
import { EditorHelpers } from '../../helpers/editor-helpers'

test.describe('MDP-001: YAML Front Matter Extraction and Rendering', () => {
  test.beforeEach(async ({ window }) => {
    await waitForAppReady(window)
  })

  test('front matter with opening and closing delimiters renders as collapsible details with key/value table', async ({
    window
  }) => {
    const editor = new EditorHelpers(window)
    const content = `---
title: My Document
author: Jane Doe
published: true
---

# Body`
    await editor.setContent(content)
    await window.waitForTimeout(500)

    const details = window.locator('.markdown-preview details.front-matter')
    await expect(details).toHaveCount(1)

    const summary = details.locator('summary')
    await expect(summary).toHaveText('Front Matter')

    const rows = details.locator('table.front-matter-table tr')
    await expect(rows).toHaveCount(3)

    const rowText = await rows.allTextContents()
    const joined = rowText.join(' | ')
    expect(joined).toContain('title')
    expect(joined).toContain('My Document')
    expect(joined).toContain('author')
    expect(joined).toContain('Jane Doe')
    expect(joined).toContain('published')
    expect(joined).toContain('true')
  })

  test('front matter raw text is removed from the rendered markdown body', async ({ window }) => {
    const editor = new EditorHelpers(window)
    const content = `---
title: Hidden Title
---

# Visible Heading

Paragraph content.`
    await editor.setContent(content)
    await window.waitForTimeout(500)

    // Heading for the body should render
    const h1 = window.locator('.markdown-body h1')
    await expect(h1).toHaveText('Visible Heading')

    // Raw "---" and "title: Hidden Title" should NOT appear in the rendered body markdown output
    // (they appear only inside the details.front-matter table)
    const bodyTextOutsideFrontMatter = await window.evaluate(() => {
      const body = document.querySelector('.markdown-body')
      if (!body) return ''
      const clone = body.cloneNode(true) as HTMLElement
      const fm = clone.querySelector('.front-matter')
      if (fm) fm.remove()
      return clone.textContent || ''
    })

    expect(bodyTextOutsideFrontMatter).not.toContain('Hidden Title')
    expect(bodyTextOutsideFrontMatter).toContain('Visible Heading')
  })

  test('document with no opening delimiter renders as-is with no front-matter element', async ({
    window
  }) => {
    const editor = new EditorHelpers(window)
    await editor.setContent('# Just a heading\n\nSome paragraph.')
    await window.waitForTimeout(500)

    const details = window.locator('.markdown-preview details.front-matter')
    await expect(details).toHaveCount(0)

    const h1 = window.locator('.markdown-body h1')
    await expect(h1).toHaveText('Just a heading')
  })

  test('document with opening delimiter but no closing delimiter renders as-is with no front-matter element', async ({
    window
  }) => {
    const editor = new EditorHelpers(window)
    const content = `---
title: Never closed
# Heading that should still render

Paragraph.`
    await editor.setContent(content)
    await window.waitForTimeout(500)

    const details = window.locator('.markdown-preview details.front-matter')
    await expect(details).toHaveCount(0)

    // The raw --- text leads the document — there's no front matter element, so the literal
    // content should appear somewhere in the body (either as hr or literal text).
    const bodyText = await window.locator('.markdown-body').textContent()
    expect(bodyText).toContain('Never closed')
  })
})
