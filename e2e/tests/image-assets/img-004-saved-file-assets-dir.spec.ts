// Traces: IMG-004 (canonical spec: specs/image-assets/spec.md)
import { test, expect, waitForAppReady } from '../../fixtures'
import { ImageFixtureDir, makeTabId } from '../../helpers/image-fixture-helpers'
import { mkdtemp, rm, writeFile, access, stat } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'

test.describe('IMG-004: Saved-File Asset Directory', () => {
  let fixtures: ImageFixtureDir
  let workDir: string

  test.beforeEach(async ({ window }) => {
    await waitForAppReady(window)
    fixtures = await ImageFixtureDir.create('wrangle-img004-')
    workDir = await mkdtemp(path.join(tmpdir(), 'wrangle-md-'))
  })

  test.afterEach(async () => {
    await fixtures.cleanup()
    await rm(workDir, { recursive: true, force: true })
  })

  test('places the image in {dirname(markdownPath)}/assets', async ({ window }) => {
    const nested = path.join(workDir, 'nested', 'deep')
    const source = await fixtures.writeImage('shot.png')
    const mdPath = path.join(nested, 'note.md')
    await writeFile(await ensureParent(mdPath), '# hi', 'utf-8')
    const tabId = makeTabId()

    const relative = await window.evaluate(
      async ({ src, tab, md }) => window.electron.file.copyImage(src, tab, md),
      { src: source, tab: tabId, md: mdPath }
    )

    expect(relative).toBe('./assets/shot.png')
    const copied = path.join(nested, 'assets', 'shot.png')
    await expect(access(copied)).resolves.toBeUndefined()
    // Not placed anywhere else.
    await expect(access(path.join(workDir, 'assets', 'shot.png'))).rejects.toThrow()
  })

  test('creates the assets directory with mkdir -p semantics when missing', async ({ window }) => {
    const source = await fixtures.writeImage('first.png')
    const mdPath = path.join(workDir, 'note.md')
    await writeFile(mdPath, '# hi', 'utf-8')
    const tabId = makeTabId()

    // Precondition: assets dir does not exist.
    await expect(access(path.join(workDir, 'assets'))).rejects.toThrow()

    const relative = await window.evaluate(
      async ({ src, tab, md }) => window.electron.file.copyImage(src, tab, md),
      { src: source, tab: tabId, md: mdPath }
    )

    expect(relative).toBe('./assets/first.png')
    const stats = await stat(path.join(workDir, 'assets'))
    expect(stats.isDirectory()).toBe(true)
  })
})

async function ensureParent(filePath: string): Promise<string> {
  const { mkdir } = await import('fs/promises')
  await mkdir(path.dirname(filePath), { recursive: true })
  return filePath
}
