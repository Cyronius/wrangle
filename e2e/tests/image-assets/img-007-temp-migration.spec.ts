// Traces: IMG-007 (canonical spec: specs/image-assets/spec.md)
import { test, expect, waitForAppReady } from '../../fixtures'
import { ImageFixtureDir, makeTabId } from '../../helpers/image-fixture-helpers'
import { mkdtemp, rm, writeFile, access, readdir, mkdir } from 'fs/promises'
import { tmpdir, homedir } from 'os'
import path from 'path'

test.describe('IMG-007: Temp Asset Migration on First Save', () => {
  let fixtures: ImageFixtureDir
  let workDir: string
  const createdTabIds: string[] = []

  test.beforeEach(async ({ window }) => {
    await waitForAppReady(window)
    fixtures = await ImageFixtureDir.create('wrangle-img007-')
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

  test('migrates every file from temp assets into {dirname(savedPath)}/assets and removes the temp dir', async ({
    window
  }) => {
    const srcA = await fixtures.writeImage('alpha.png')
    const srcB = await fixtures.writeImage('beta.jpg')
    const tabId = makeTabId()
    createdTabIds.push(tabId)

    // Populate temp via copyImage (null markdown path)
    await window.evaluate(
      async ({ src, tab }) => window.electron.file.copyImage(src, tab, null),
      { src: srcA, tab: tabId }
    )
    await window.evaluate(
      async ({ src, tab }) => window.electron.file.copyImage(src, tab, null),
      { src: srcB, tab: tabId }
    )
    const tempRoot = path.join(homedir(), '.wrangle', 'drafts', tabId)
    await expect(access(path.join(tempRoot, 'assets', 'alpha.png'))).resolves.toBeUndefined()

    const savedPath = path.join(workDir, 'saved.md')
    await writeFile(savedPath, '# saved', 'utf-8')

    const ok = await window.evaluate(
      async ({ tab, p }) => window.electron.file.moveTempFiles(tab, p),
      { tab: tabId, p: savedPath }
    )

    expect(ok).toBe(true)
    const migrated = (await readdir(path.join(workDir, 'assets'))).sort()
    expect(migrated).toEqual(['alpha.png', 'beta.jpg'])
    // Temp per-tab dir has been removed.
    await expect(access(tempRoot)).rejects.toThrow()
  })

  test('is a no-op and returns true when the tab has no temp assets directory', async ({
    window
  }) => {
    const tabId = makeTabId() // never used before
    const savedPath = path.join(workDir, 'empty.md')
    await writeFile(savedPath, '# empty', 'utf-8')

    const ok = await window.evaluate(
      async ({ tab, p }) => window.electron.file.moveTempFiles(tab, p),
      { tab: tabId, p: savedPath }
    )

    expect(ok).toBe(true)
    // No assets directory should have been created alongside the saved file.
    await expect(access(path.join(workDir, 'assets'))).rejects.toThrow()
  })

  test('does not recurse into subdirectories of the temp assets dir', async ({ window }) => {
    const src = await fixtures.writeImage('top.png')
    const tabId = makeTabId()
    createdTabIds.push(tabId)

    await window.evaluate(
      async ({ source, tab }) => window.electron.file.copyImage(source, tab, null),
      { source: src, tab: tabId }
    )
    const tempAssets = path.join(homedir(), '.wrangle', 'drafts', tabId, 'assets')
    // Create a subdirectory with a nested file that must NOT be migrated.
    await mkdir(path.join(tempAssets, 'nested'), { recursive: true })
    await writeFile(path.join(tempAssets, 'nested', 'hidden.png'), Buffer.from([0]))

    const savedPath = path.join(workDir, 'doc.md')
    await writeFile(savedPath, '# saved', 'utf-8')

    const ok = await window.evaluate(
      async ({ tab, p }) => window.electron.file.moveTempFiles(tab, p),
      { tab: tabId, p: savedPath }
    )

    expect(ok).toBe(true)
    const migrated = await readdir(path.join(workDir, 'assets'))
    expect(migrated).toEqual(['top.png'])
    expect(migrated).not.toContain('nested')
  })
})
