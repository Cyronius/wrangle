// Traces: IMG-002 (canonical spec: specs/image-assets/spec.md)
import { test, expect, waitForAppReady } from '../../fixtures'
import { ImageFixtureDir, makeTabId } from '../../helpers/image-fixture-helpers'
import { mkdtemp, rm, writeFile, access, readdir } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'

test.describe('IMG-002: Filename Sanitization', () => {
  let fixtures: ImageFixtureDir
  let workDir: string

  test.beforeEach(async ({ window }) => {
    await waitForAppReady(window)
    fixtures = await ImageFixtureDir.create('wrangle-img002-')
    workDir = await mkdtemp(path.join(tmpdir(), 'wrangle-md-'))
  })

  test.afterEach(async () => {
    await fixtures.cleanup()
    await rm(workDir, { recursive: true, force: true })
  })

  test('replaces spaces and punctuation with underscores while preserving the extension', async ({
    window
  }) => {
    const source = await fixtures.writeImage('my cool picture!.png')
    const mdPath = path.join(workDir, 'doc.md')
    await writeFile(mdPath, '# hi', 'utf-8')
    const tabId = makeTabId()

    const relative = await window.evaluate(
      async ({ src, tab, md }) => window.electron.file.copyImage(src, tab, md),
      { src: source, tab: tabId, md: mdPath }
    )

    expect(relative).toBe('./assets/my_cool_picture_.png')
    const assetFiles = await readdir(path.join(workDir, 'assets'))
    expect(assetFiles).toContain('my_cool_picture_.png')
  })

  test('preserves allowed characters [a-zA-Z0-9-_] and mixed case', async ({ window }) => {
    const source = await fixtures.writeImage('My-Image_01.PNG')
    const mdPath = path.join(workDir, 'doc.md')
    await writeFile(mdPath, '# hi', 'utf-8')
    const tabId = makeTabId()

    const relative = await window.evaluate(
      async ({ src, tab, md }) => window.electron.file.copyImage(src, tab, md),
      { src: source, tab: tabId, md: mdPath }
    )

    // Extension is preserved as-is from source (not lower-cased).
    expect(relative).toBe('./assets/My-Image_01.PNG')
    await expect(access(path.join(workDir, 'assets', 'My-Image_01.PNG'))).resolves.toBeUndefined()
  })

  test('sanitization applies to the temp (unsaved) directory as well', async ({ window }) => {
    const source = await fixtures.writeImage('unsaved draft (v2).png')
    const tabId = makeTabId()

    const relative = await window.evaluate(
      async ({ src, tab }) => window.electron.file.copyImage(src, tab, null),
      { src: source, tab: tabId }
    )

    expect(relative).toBe('./assets/unsaved_draft__v2_.png')

    // Verify via preload that the file exists in the temp dir
    const tempDir = await window.evaluate(
      async (tab) => window.electron.file.getTempDir(tab),
      tabId
    )
    const files = await readdir(path.join(tempDir, 'assets'))
    expect(files).toContain('unsaved_draft__v2_.png')

    await window.evaluate(async (tab) => window.electron.file.cleanupTemp(tab), tabId)
  })
})
