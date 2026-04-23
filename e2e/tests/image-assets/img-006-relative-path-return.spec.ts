// Traces: IMG-006 (canonical spec: specs/image-assets/spec.md)
import { test, expect, waitForAppReady } from '../../fixtures'
import { ImageFixtureDir, makeTabId } from '../../helpers/image-fixture-helpers'
import { mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'

test.describe('IMG-006: Relative Path Return Value', () => {
  let fixtures: ImageFixtureDir
  let workDir: string
  const createdTabIds: string[] = []

  test.beforeEach(async ({ window }) => {
    await waitForAppReady(window)
    fixtures = await ImageFixtureDir.create('wrangle-img006-')
    workDir = await mkdtemp(path.join(tmpdir(), 'wrangle-md-'))
  })

  test.afterEach(async ({ window }) => {
    for (const tabId of createdTabIds) {
      await window.evaluate(async (t) => window.electron.file.cleanupTemp(t), tabId)
    }
    createdTabIds.length = 0
    await fixtures.cleanup()
    await rm(workDir, { recursive: true, force: true })
  })

  test('return shape is ./assets/{finalFilename} with forward slashes on saved tabs', async ({
    window
  }) => {
    const source = await fixtures.writeImage('has space.png')
    const mdPath = path.join(workDir, 'note.md')
    await writeFile(mdPath, '# hi', 'utf-8')
    const tabId = makeTabId()

    const relative = await window.evaluate(
      async ({ src, tab, md }) => window.electron.file.copyImage(src, tab, md),
      { src: source, tab: tabId, md: mdPath }
    )

    expect(relative).toBe('./assets/has_space.png')
    expect(relative).not.toContain('\\')
    expect(relative!.startsWith('./assets/')).toBe(true)
  })

  test('return shape is identical for temp (unsaved) destinations', async ({ window }) => {
    const source = await fixtures.writeImage('temp file!.png')
    const tabId = makeTabId()
    createdTabIds.push(tabId)

    const relative = await window.evaluate(
      async ({ src, tab }) => window.electron.file.copyImage(src, tab, null),
      { src: source, tab: tabId }
    )

    expect(relative).toBe('./assets/temp_file_.png')
    expect(relative).not.toContain('\\')
  })

  test('returns null on error (non-existent source)', async ({ window }) => {
    const bogus = path.join(fixtures.dir, 'missing.png')
    const mdPath = path.join(workDir, 'note.md')
    await writeFile(mdPath, '# hi', 'utf-8')
    const tabId = makeTabId()

    const relative = await window.evaluate(
      async ({ src, tab, md }) => window.electron.file.copyImage(src, tab, md),
      { src: bogus, tab: tabId, md: mdPath }
    )

    expect(relative).toBeNull()
  })
})
