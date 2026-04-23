// Traces: MDP-002 (canonical spec: specs/markdown-preview/spec.md)
import { test, expect, waitForAppReady } from '../../fixtures'
import { EditorHelpers } from '../../helpers/editor-helpers'

test.describe('MDP-002: GitHub Flavored Markdown Support', () => {
  test.beforeEach(async ({ window }) => {
    await waitForAppReady(window)
  })

  test('pipe tables render as <table> with header row and body rows', async ({ window }) => {
    const editor = new EditorHelpers(window)
    const content = `| Name | Age |
| ---- | --- |
| Ada  | 37  |
| Bob  | 42  |
`
    await editor.setContent(content)
    await window.waitForTimeout(500)

    const table = window.locator('.markdown-body table')
    await expect(table).toHaveCount(1)

    const headerCells = table.locator('thead th')
    await expect(headerCells).toHaveCount(2)
    await expect(headerCells.nth(0)).toHaveText('Name')
    await expect(headerCells.nth(1)).toHaveText('Age')

    const bodyRows = table.locator('tbody tr')
    await expect(bodyRows).toHaveCount(2)
    await expect(bodyRows.nth(0).locator('td').nth(0)).toHaveText('Ada')
    await expect(bodyRows.nth(1).locator('td').nth(1)).toHaveText('42')
  })

  test('strikethrough ~~text~~ renders as <del>', async ({ window }) => {
    const editor = new EditorHelpers(window)
    await editor.setContent('This is ~~deleted~~ text.')
    await window.waitForTimeout(500)

    const del = window.locator('.markdown-body del')
    await expect(del).toHaveCount(1)
    await expect(del).toHaveText('deleted')
  })

  test('task list items render with checkbox inputs reflecting checked state', async ({
    window
  }) => {
    const editor = new EditorHelpers(window)
    const content = `- [ ] Unchecked task
- [x] Checked task
`
    await editor.setContent(content)
    await window.waitForTimeout(500)

    const checkboxes = window.locator('.markdown-body input[type="checkbox"]')
    await expect(checkboxes).toHaveCount(2)

    expect(await checkboxes.nth(0).isChecked()).toBe(false)
    expect(await checkboxes.nth(1).isChecked()).toBe(true)
  })

  test('autolinks (bare URLs) render as <a> elements', async ({ window }) => {
    const editor = new EditorHelpers(window)
    await editor.setContent('Visit https://example.com for more info.')
    await window.waitForTimeout(500)

    const link = window.locator('.markdown-body a[href="https://example.com"]')
    await expect(link).toHaveCount(1)
    await expect(link).toHaveText('https://example.com')
  })

  test('standard CommonMark features (headings, emphasis, blockquote, fenced code) render', async ({
    window
  }) => {
    const editor = new EditorHelpers(window)
    const content = `# H1
## H2

*italic* and **bold**

> a blockquote

\`\`\`
plain code
\`\`\`
`
    await editor.setContent(content)
    await window.waitForTimeout(500)

    await expect(window.locator('.markdown-body h1')).toHaveText('H1')
    await expect(window.locator('.markdown-body h2')).toHaveText('H2')
    await expect(window.locator('.markdown-body em')).toHaveText('italic')
    await expect(window.locator('.markdown-body strong')).toHaveText('bold')
    await expect(window.locator('.markdown-body blockquote')).toContainText('a blockquote')
    await expect(window.locator('.markdown-body pre code')).toContainText('plain code')
  })
})
