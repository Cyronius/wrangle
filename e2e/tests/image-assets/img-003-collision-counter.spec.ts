// Traces: IMG-003 (canonical spec: specs/image-assets/spec.md)
import { test, expect, waitForAppReady } from '../../fixtures'
import { ImageFixtureDir, makeTabId } from '../../helpers/image-fixture-helpers'
import { mkdtemp, rm, writeFile, access, readdir } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'

test.describe('IMG-003: Collision Counter Suffix', () => {
  let fixtures: ImageFixtureDir
  let workDir: string

  test.beforeEach(async ({ window }) => {
    await waitForAppReady(window)
    fixtures = await ImageFixtureDir.create('wrangle-img003-')
    workDir = await mkdtemp(path.join(tmpdir(), 'wrangle-md-'))
  })

  test.afterEach(async () => {
    await fixtures.cleanup()
    await rm(workDir, { recursive: true, force: true })
  })

  test('second copy of the same filename gets an _1 suffix', async ({ window }) => {
    const source = await fixtures.writeImage('photo.png')
    const mdPath = path.join(workDir, 'doc.md')
    await writeFile(mdPath, '# hi', 'utf-8')
    const tabId = makeTabId()

    const first = await window.evaluate(
      async ({ src, tab, md }) => window.electron.file.copyImage(src, tab, md),
      { src: source, tab: tabId, md: mdPath }
    )
    const second = await window.evaluate(
      async ({ src, tab, md }) => window.electron.file.copyImage(src, tab, md),
      { src: source, tab: tabId, md: mdPath }
    )

    expect(first).toBe('./assets/photo.png')
    expect(second).toBe('./assets/photo_1.png')
    await expect(access(path.join(workDir, 'assets', 'photo.png'))).resolves.toBeUndefined()
    await expect(access(path.join(workDir, 'assets', 'photo_1.png'))).resolves.toBeUndefined()
  })

  test('counter increments sequentially _1, _2, _3 for repeated collisions', async ({
    window
  }) => {
    const source = await fixtures.writeImage('pic.png')
    const mdPath = path.join(workDir, 'doc.md')
    await writeFile(mdPath, '# hi', 'utf-8')
    const tabId = makeTabId()

    const results: (string | null)[] = []
    for (let i = 0; i < 4; i++) {
      results.push(
        await window.evaluate(
          async ({ src, tab, md }) => window.electron.file.copyImage(src, tab, md),
          { src: source, tab: tabId, md: mdPath }
        )
      )
    }

    expect(results).toEqual([
      './assets/pic.png',
      './assets/pic_1.png',
      './assets/pic_2.png',
      './assets/pic_3.png'
    ])
    const files = (await readdir(path.join(workDir, 'assets'))).sort()
    expect(files).toEqual(['pic.png', 'pic_1.png', 'pic_2.png', 'pic_3.png'])
  })

  test('suffix is inserted before the extension, not appended to the filename', async ({
    window
  }) => {
    const source = await fixtures.writeImage('thumbnail.jpg')
    const mdPath = path.join(workDir, 'doc.md')
    await writeFile(mdPath, '# hi', 'utf-8')
    const tabId = makeTabId()

    await window.evaluate(
      async ({ src, tab, md }) => window.electron.file.copyImage(src, tab, md),
      { src: source, tab: tabId, md: mdPath }
    )
    const second = await window.evaluate(
      async ({ src, tab, md }) => window.electron.file.copyImage(src, tab, md),
      { src: source, tab: tabId, md: mdPath }
    )

    expect(second).toBe('./assets/thumbnail_1.jpg')
    // Sanity: the literal "thumbnail.jpg_1" should NOT exist.
    await expect(access(path.join(workDir, 'assets', 'thumbnail.jpg_1'))).rejects.toThrow()
  })
})
