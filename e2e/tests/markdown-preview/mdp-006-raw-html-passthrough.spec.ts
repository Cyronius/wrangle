// Traces: MDP-006 (canonical spec: specs/markdown-preview/spec.md)
import { test, expect, waitForAppReady } from '../../fixtures'
import { EditorHelpers } from '../../helpers/editor-helpers'

test.describe('MDP-006: Raw HTML Passthrough', () => {
  test.beforeEach(async ({ window }) => {
    await waitForAppReady(window)
  })

  test('block-level HTML (<div>, <details>) appears as real elements in the rendered DOM', async ({
    window
  }) => {
    const editor = new EditorHelpers(window)
    const content = `<div class="custom-block" data-testid="mdp006-div">Block content here</div>

<details>
<summary>Click me</summary>
Hidden content
</details>
`
    await editor.setContent(content)
    await window.waitForTimeout(500)

    const div = window.locator('.markdown-body div.custom-block[data-testid="mdp006-div"]')
    await expect(div).toHaveCount(1)
    await expect(div).toContainText('Block content here')

    const details = window.locator('.markdown-body details')
    await expect(details).toHaveCount(1)
    await expect(details.locator('summary')).toHaveText('Click me')
  })

  test('inline HTML (<span>, <kbd>, <br>) is preserved in its surrounding paragraph', async ({
    window
  }) => {
    const editor = new EditorHelpers(window)
    const content = `Press <kbd>Ctrl</kbd>+<kbd>S</kbd> to save.<br>Next line via br.

A <span class="inline-marker" data-testid="mdp006-span">highlighted</span> word.`
    await editor.setContent(content)
    await window.waitForTimeout(500)

    const kbd = window.locator('.markdown-body kbd')
    await expect(kbd).toHaveCount(2)
    await expect(kbd.nth(0)).toHaveText('Ctrl')
    await expect(kbd.nth(1)).toHaveText('S')

    const span = window.locator('.markdown-body span.inline-marker[data-testid="mdp006-span"]')
    await expect(span).toHaveCount(1)
    await expect(span).toHaveText('highlighted')

    const br = window.locator('.markdown-body br')
    expect(await br.count()).toBeGreaterThanOrEqual(1)
  })

  test('raw HTML is NOT escaped as literal text', async ({ window }) => {
    const editor = new EditorHelpers(window)
    await editor.setContent('<div data-testid="raw-passthrough">Real div</div>')
    await window.waitForTimeout(500)

    const bodyHtml = await window.locator('.markdown-body').innerHTML()
    // The <div> appears in HTML as an actual element, not as escaped "&lt;div&gt;"
    expect(bodyHtml).toContain('data-testid="raw-passthrough"')
    expect(bodyHtml).not.toContain('&lt;div data-testid="raw-passthrough"&gt;')
  })
})
