// Traces: MDP-008 (canonical spec: specs/markdown-preview/spec.md)
import { test, expect, waitForAppReady } from '../../fixtures'
import { EditorHelpers } from '../../helpers/editor-helpers'

test.describe('MDP-008: Error Boundary with Content-Change Recovery', () => {
  test.beforeEach(async ({ window }) => {
    await waitForAppReady(window)
  })

  test('preview chrome (.markdown-preview + .markdown-body) remains mounted even with problematic content', async ({
    window
  }) => {
    const editor = new EditorHelpers(window)
    // Unclosed math / malformed content that can stress plugins
    await editor.setContent('$$\n\\frac{1}{0\n$$\n\n<div><span></p></div>\n\n# After\n')
    await window.waitForTimeout(800)

    await expect(window.locator('.markdown-preview')).toBeVisible()
    await expect(window.locator('.markdown-body')).toBeAttached()
  })

  test('on recoverable content, no script tags injected via markdown execute in the renderer', async ({
    window
  }) => {
    const editor = new EditorHelpers(window)
    // Set a sentinel before typing content containing a <script>
    await window.evaluate(() => {
      ;(window as unknown as { __mdp008Pwned?: boolean }).__mdp008Pwned = false
    })

    await editor.setContent(
      '# Safe\n\n<script>window.__mdp008Pwned = true;</script>\n\nAfter.\n'
    )
    await window.waitForTimeout(800)

    // Heading still rendered
    await expect(window.locator('.markdown-body h1')).toHaveText('Safe')

    // Script did not execute — rehype-raw inserts the node but browsers do not execute
    // scripts created via innerHTML-style insertion, so the sentinel must remain false.
    const pwned = await window.evaluate(
      () => (window as unknown as { __mdp008Pwned?: boolean }).__mdp008Pwned
    )
    expect(pwned).toBe(false)
  })

  test('changing content after a problematic render lets the preview recover and render new content', async ({
    window
  }) => {
    const editor = new EditorHelpers(window)

    // First set potentially problematic content
    await editor.setContent('$$\n\\invalid{latex\n$$\n\n# Original\n')
    await window.waitForTimeout(800)

    // Now change content to something simple
    await editor.setContent('# Recovered\n\nA clean paragraph.\n')
    await window.waitForTimeout(800)

    // The new content must render — heading text updated, paragraph present
    await expect(window.locator('.markdown-body h1')).toHaveText('Recovered')
    await expect(window.locator('.markdown-body p').first()).toContainText('A clean paragraph.')

    // No error fallback UI should be visible anymore
    const fallback = window.locator('.markdown-body')
    await expect(fallback).not.toContainText('Preview could not render this content.')
  })

  test('normal content renders without the fallback UI ever appearing', async ({ window }) => {
    const editor = new EditorHelpers(window)
    await editor.setContent('# Hello\n\nRegular paragraph with *emphasis*.\n')
    await window.waitForTimeout(800)

    await expect(window.locator('.markdown-body h1')).toHaveText('Hello')
    const body = window.locator('.markdown-body')
    await expect(body).not.toContainText('Preview could not render this content.')
  })
})
