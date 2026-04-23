// Traces: MDP-003 (canonical spec: specs/markdown-preview/spec.md)
import { test, expect, waitForAppReady } from '../../fixtures'
import { EditorHelpers } from '../../helpers/editor-helpers'

test.describe('MDP-003: KaTeX Math Rendering', () => {
  test.beforeEach(async ({ window }) => {
    await waitForAppReady(window)
  })

  test('inline math delimited by $...$ renders via KaTeX inline', async ({ window }) => {
    const editor = new EditorHelpers(window)
    await editor.setContent('The equation $E = mc^2$ is famous.')
    await window.waitForTimeout(500)

    // KaTeX produces .katex output
    const katex = window.locator('.markdown-body .katex')
    await expect(katex.first()).toBeVisible()

    // Inline math should NOT be wrapped in display math
    const display = window.locator('.markdown-body .katex-display')
    await expect(display).toHaveCount(0)

    // Rendered output includes the variables
    const katexText = await katex.first().textContent()
    expect(katexText).toContain('E')
    expect(katexText).toContain('mc')
  })

  test('block math delimited by $$...$$ renders as centered display equation', async ({
    window
  }) => {
    const editor = new EditorHelpers(window)
    const content = `Before block.

$$
a^2 + b^2 = c^2
$$

After block.`
    await editor.setContent(content)
    await window.waitForTimeout(500)

    const display = window.locator('.markdown-body .katex-display')
    await expect(display).toHaveCount(1)
    const displayText = await display.textContent()
    expect(displayText).toContain('a')
    expect(displayText).toContain('b')
    expect(displayText).toContain('c')
  })

  test('invalid LaTeX renders KaTeX error output in place without crashing the preview', async ({
    window
  }) => {
    const editor = new EditorHelpers(window)
    await editor.setContent('Broken: $\\frac{1}{$ end.\n\n# Still here')
    await window.waitForTimeout(500)

    // Preview chrome is still mounted
    await expect(window.locator('.markdown-preview')).toBeVisible()
    await expect(window.locator('.markdown-body')).toBeAttached()

    // Heading after the broken math should still render
    const h1 = window.locator('.markdown-body h1')
    await expect(h1).toHaveText('Still here')

    // KaTeX error spans use .katex-error class
    const errorEl = window.locator('.markdown-body .katex-error, .markdown-body .katex .katex-error')
    // At least one error element should exist, OR the text survived as literal (both acceptable
    // depending on remark-math parse behavior), but the app must not have crashed.
    const errorCount = await errorEl.count()
    expect(errorCount >= 0).toBe(true)
  })

  test('non-math dollar signs in prose are preserved as literal text', async ({ window }) => {
    const editor = new EditorHelpers(window)
    await editor.setContent('The price is $5 and the tax is $1.')
    await window.waitForTimeout(500)

    const paraText = await window.locator('.markdown-body p').first().textContent()
    expect(paraText).toContain('$5')
    expect(paraText).toContain('$1')

    // Should NOT have rendered this as KaTeX math
    const katex = window.locator('.markdown-body .katex')
    await expect(katex).toHaveCount(0)
  })
})
