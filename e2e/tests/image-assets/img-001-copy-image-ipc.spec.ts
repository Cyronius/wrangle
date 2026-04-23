// Traces: IMG-001 (canonical spec: specs/image-assets/spec.md)
import { test, expect, waitForAppReady } from '../../fixtures'
import { ImageFixtureDir, makeTabId } from '../../helpers/image-fixture-helpers'
import { mkdtemp, rm, writeFile, access } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'

test.describe('IMG-001: Drag-and-Drop Image Copy IPC', () => {
  let fixtures: ImageFixtureDir
  let workDir: string

  test.beforeEach(async ({ window }) => {
    await waitForAppReady(window)
    fixtures = await ImageFixtureDir.create('wrangle-img001-')
    workDir = await mkdtemp(path.join(tmpdir(), 'wrangle-md-'))
  })

  test.afterEach(async ({ window }) => {
    await fixtures.cleanup()
    await rm(workDir, { recursive: true, force: true })
    // Clean up any tabs we created in the draft dir
    await window.evaluate(async () => {
      // no-op placeholder; per-test cleanup is handled inline
    })
  })

  test('copyImage returns a relative path and copies the file for a saved markdown tab', async ({
    window
  }) => {
    const source = await fixtures.writeImage('source.png')
    const mdPath = path.join(workDir, 'doc.md')
    await writeFile(mdPath, '# hi', 'utf-8')
    const tabId = makeTabId()

    const relative = await window.evaluate(
      async ({ src, tab, md }) => window.electron.file.copyImage(src, tab, md),
      { src: source, tab: tabId, md: mdPath }
    )

    expect(relative).not.toBeNull()
    expect(relative).toBe('./assets/source.png')
    await expect(access(path.join(workDir, 'assets', 'source.png'))).resolves.toBeUndefined()
  })

  test('copyImage returns null when source path does not exist and surfaces no markdown path', async ({
    window
  }) => {
    const bogus = path.join(fixtures.dir, 'does-not-exist.png')
    const mdPath = path.join(workDir, 'doc2.md')
    await writeFile(mdPath, '# hi', 'utf-8')
    const tabId = makeTabId()

    const relative = await window.evaluate(
      async ({ src, tab, md }) => window.electron.file.copyImage(src, tab, md),
      { src: bogus, tab: tabId, md: mdPath }
    )

    // Note: on failure the handler returns null (main also surfaces a dialog,
    // which we cannot assert against here without stubbing dialog).
    expect(relative).toBeNull()
  })

  test('copyImage accepts null markdown path and still returns a relative path', async ({
    window
  }) => {
    const source = await fixtures.writeImage('draft-img.png')
    const tabId = makeTabId()

    const relative = await window.evaluate(
      async ({ src, tab }) => window.electron.file.copyImage(src, tab, null),
      { src: source, tab: tabId }
    )

    expect(relative).toBe('./assets/draft-img.png')

    // Clean up the temp draft dir for this tab
    await window.evaluate(async (tab) => window.electron.file.cleanupTemp(tab), tabId)
  })
})
