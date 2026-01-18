import { test, expect, waitForAppReady, waitForMonacoReady } from '../fixtures'

test.describe('App Launch', () => {
  test('should launch the Electron app', async ({ electronApp, window }) => {
    // Verify the app launched
    expect(electronApp).toBeDefined()
    expect(window).toBeDefined()
  })

  test('should show the main window', async ({ window }) => {
    // Wait for the app to be ready
    await waitForAppReady(window)

    // Check that the window has content
    const title = await window.title()
    expect(title).toBeTruthy()
  })

  test('should initialize Monaco editor', async ({ window }) => {
    await waitForMonacoReady(window)

    // Check that Monaco editor is present
    const editor = await window.$('.monaco-editor')
    expect(editor).toBeTruthy()

    // Check that the editor is interactive
    const viewLines = await window.$('.monaco-editor .view-lines')
    expect(viewLines).toBeTruthy()
  })

  test('should show preview pane in split mode', async ({ window }) => {
    await waitForAppReady(window)

    // Check for markdown preview
    const preview = await window.$('.markdown-preview')
    expect(preview).toBeTruthy()
  })

  test('should be able to type in editor', async ({ window }) => {
    await waitForAppReady(window)

    // Click on editor
    await window.click('.monaco-editor')

    // Type some text
    const testText = '# Test Heading'
    await window.keyboard.type(testText)

    // Wait for preview to render
    await window.waitForTimeout(500)

    // Check that heading appears in preview
    const heading = await window.$('.markdown-body h1')
    expect(heading).toBeTruthy()
  })
})
