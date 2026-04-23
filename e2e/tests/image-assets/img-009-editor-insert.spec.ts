// Traces: IMG-009 (canonical spec: specs/image-assets/spec.md)
import { test, expect, waitForAppReady, waitForMonacoReady } from '../../fixtures'
import { EditorHelpers } from '../../helpers/editor-helpers'
import { ImageFixtureDir } from '../../helpers/image-fixture-helpers'

test.describe('IMG-009: Editor Inserts Markdown Image Syntax at Cursor', () => {
  let fixtures: ImageFixtureDir

  test.beforeEach(async ({ window }) => {
    await waitForAppReady(window)
    await waitForMonacoReady(window)
    fixtures = await ImageFixtureDir.create('wrangle-img009-')
  })

  test.afterEach(async () => {
    await fixtures.cleanup()
  })

  // Native OS-level drag-drop of files onto Electron is not something Playwright
  // can reliably simulate cross-platform: Chromium's CDP `Input.dispatchDragEvent`
  // requires a real `File` object with a filesystem path, which the renderer
  // obtains via Electron's `webUtils.getPathForFile` (or the deprecated `file.path`).
  // There's no supported way to synthesize that from outside the page context.
  test.fixme(
    'inserts ![{originalFilename}]({relativePath})\\n at the cursor when an image is dropped',
    async () => {
      // Un-automatable: cannot synthesize a DragEvent with a real File whose
      // renderer-side .path is populated by Electron's webUtils bridge.
    }
  )

  test.fixme(
    'replaces the current selection with the markdown image syntax',
    async () => {
      // Un-automatable for the same reason as above (drag-drop synthesis).
    }
  )

  test.fixme(
    'processes multiple images sequentially, each inserted after the previous',
    async () => {
      // Un-automatable for the same reason as above (drag-drop synthesis).
    }
  )

  test('skips editor insertion gracefully when no editor is focused but still returns a relative path from copyImage', async ({
    window
  }) => {
    // This covers the "if no Monaco editor reference is available" branch at
    // the IPC boundary: copyImage itself must always return a relative path.
    const source = await fixtures.writeImage('standalone.png')
    const tabId = 'img009-no-editor'

    const relative = await window.evaluate(
      async ({ src, tab }) => window.electron.file.copyImage(src, tab, null),
      { src: source, tab: tabId }
    )

    expect(relative).toBe('./assets/standalone.png')

    // The editor buffer should be unchanged by an IPC-only copy.
    const editor = new EditorHelpers(window)
    const content = await editor.getFullContent()
    expect(content).not.toContain('![standalone.png]')

    await window.evaluate(async (t) => window.electron.file.cleanupTemp(t), tabId)
  })
})
