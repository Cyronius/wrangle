// Traces: MDP-004 (canonical spec: specs/markdown-preview/spec.md)
// Status: Deferred — Mermaid wiring is not yet implemented in the preview pipeline
// (see MDP-004 interface contract). These tests are marked as fixme until a plan
// re-activates the requirement with a real Mermaid renderer.
import { test, expect, waitForAppReady } from '../../fixtures'
import { EditorHelpers } from '../../helpers/editor-helpers'

test.describe('MDP-004: Mermaid Diagram Rendering', () => {
  test.beforeEach(async ({ window }) => {
    await waitForAppReady(window)
  })

  test.fixme('fenced ```mermaid block renders as an SVG diagram', async ({ window }) => {
    const editor = new EditorHelpers(window)
    const content = '```mermaid\ngraph TD; A-->B;\n```\n'
    await editor.setContent(content)
    await window.waitForTimeout(1000)

    const svg = window.locator('.markdown-body .mermaid-diagram svg, .markdown-body svg')
    await expect(svg.first()).toBeVisible()
  })

  test.fixme('rendered SVG replaces the original code block content', async ({ window }) => {
    const editor = new EditorHelpers(window)
    await editor.setContent('```mermaid\ngraph LR; X-->Y;\n```\n')
    await window.waitForTimeout(1000)

    // Raw mermaid source should not appear as a code element
    const rawCode = window.locator('.markdown-body pre code.language-mermaid')
    await expect(rawCode).toHaveCount(0)
  })

  test.fixme('invalid Mermaid source renders a diagnostic message without crashing', async ({
    window
  }) => {
    const editor = new EditorHelpers(window)
    await editor.setContent('```mermaid\nnot valid mermaid!!!\n```\n\n# After')
    await window.waitForTimeout(1000)

    await expect(window.locator('.markdown-body h1')).toHaveText('After')
    const errorEl = window.locator('.markdown-body .mermaid-error')
    await expect(errorEl).toHaveCount(1)
  })

  test.fixme('diagrams re-render when the underlying source changes', async ({ window }) => {
    const editor = new EditorHelpers(window)
    await editor.setContent('```mermaid\ngraph TD; A-->B;\n```\n')
    await window.waitForTimeout(1000)
    const before = await window.locator('.markdown-body svg').first().innerHTML()

    await editor.setContent('```mermaid\ngraph TD; A-->B; B-->C;\n```\n')
    await window.waitForTimeout(1000)
    const after = await window.locator('.markdown-body svg').first().innerHTML()

    expect(after).not.toEqual(before)
  })
})
