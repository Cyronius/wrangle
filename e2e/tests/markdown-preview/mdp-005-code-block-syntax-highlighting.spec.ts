// Traces: MDP-005 (canonical spec: specs/markdown-preview/spec.md)
import { test, expect, waitForAppReady } from '../../fixtures'
import { EditorHelpers } from '../../helpers/editor-helpers'

test.describe('MDP-005: Code Block Syntax Highlighting', () => {
  test.beforeEach(async ({ window }) => {
    await waitForAppReady(window)
  })

  test('fenced code block with language tag carries language-<name> class', async ({ window }) => {
    const editor = new EditorHelpers(window)
    const content = '```typescript\nconst x: number = 42;\n```\n'
    await editor.setContent(content)
    await window.waitForTimeout(500)

    const codeEl = window.locator('.markdown-body pre code.language-typescript')
    await expect(codeEl).toHaveCount(1)
  })

  test('highlight.js wraps tokens in <span class="hljs-*"> elements', async ({ window }) => {
    const editor = new EditorHelpers(window)
    const content = '```javascript\nconst greeting = "hello";\nfunction sayHi() { return greeting; }\n```\n'
    await editor.setContent(content)
    await window.waitForTimeout(500)

    const codeEl = window.locator('.markdown-body pre code.language-javascript')
    await expect(codeEl).toHaveCount(1)

    const hljsSpans = codeEl.locator('span[class*="hljs-"]')
    const count = await hljsSpans.count()
    expect(count).toBeGreaterThan(0)

    // At least one class on a nested span should start with "hljs-"
    const classes = await hljsSpans.evaluateAll((els) =>
      els.map((e) => e.className)
    )
    expect(classes.some((c) => c.includes('hljs-'))).toBe(true)
  })

  test('unknown/missing language renders as plain text with no hljs tokenization', async ({
    window
  }) => {
    const editor = new EditorHelpers(window)
    const content = '```\njust some plain text\nwith no language tag\n```\n'
    await editor.setContent(content)
    await window.waitForTimeout(500)

    const preCode = window.locator('.markdown-body pre code')
    await expect(preCode).toHaveCount(1)
    await expect(preCode).toContainText('just some plain text')

    // No language class, and no hljs-* children
    const hasLanguageClass = await preCode.evaluate((el) =>
      Array.from(el.classList).some((c) => c.startsWith('language-'))
    )
    expect(hasLanguageClass).toBe(false)

    const hljsSpans = preCode.locator('span[class*="hljs-"]')
    await expect(hljsSpans).toHaveCount(0)
  })

  test('inline code spans are not syntax-highlighted', async ({ window }) => {
    const editor = new EditorHelpers(window)
    await editor.setContent('Inline `const x = 1` example.')
    await window.waitForTimeout(500)

    // Inline code = <code> NOT inside <pre>
    const inlineCode = window.locator('.markdown-body p code')
    await expect(inlineCode).toHaveCount(1)

    const hljsSpans = inlineCode.locator('span[class*="hljs-"]')
    await expect(hljsSpans).toHaveCount(0)
  })
})
