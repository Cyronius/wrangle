// Traces: IMG-005 (canonical spec: specs/image-assets/spec.md)
import { test, expect, waitForAppReady } from '../../fixtures'
import { ImageFixtureDir, makeTabId } from '../../helpers/image-fixture-helpers'
import { access } from 'fs/promises'
import path from 'path'
import { homedir } from 'os'

test.describe('IMG-005: Unsaved-File Temp Asset Directory', () => {
  let fixtures: ImageFixtureDir
  const createdTabIds: string[] = []

  test.beforeEach(async ({ window }) => {
    await waitForAppReady(window)
    fixtures = await ImageFixtureDir.create('wrangle-img005-')
  })

  test.afterEach(async ({ window }) => {
    for (const tabId of createdTabIds) {
      await window.evaluate(async (t) => window.electron.file.cleanupTemp(t), tabId)
    }
    createdTabIds.length = 0
    await fixtures.cleanup()
  })

  test('copies to {homedir}/.wrangle/drafts/{tabId}/assets when markdown path is null', async ({
    window
  }) => {
    const source = await fixtures.writeImage('draft.png')
    const tabId = makeTabId()
    createdTabIds.push(tabId)

    const relative = await window.evaluate(
      async ({ src, tab }) => window.electron.file.copyImage(src, tab, null),
      { src: source, tab: tabId }
    )

    expect(relative).toBe('./assets/draft.png')
    const expected = path.join(homedir(), '.wrangle', 'drafts', tabId, 'assets', 'draft.png')
    await expect(access(expected)).resolves.toBeUndefined()
  })

  test('each tab has its own isolated asset directory keyed by tabId', async ({ window }) => {
    const srcA = await fixtures.writeImage('a.png')
    const srcB = await fixtures.writeImage('b.png')
    const tabA = makeTabId('tA')
    const tabB = makeTabId('tB')
    createdTabIds.push(tabA, tabB)

    const relA = await window.evaluate(
      async ({ src, tab }) => window.electron.file.copyImage(src, tab, null),
      { src: srcA, tab: tabA }
    )
    const relB = await window.evaluate(
      async ({ src, tab }) => window.electron.file.copyImage(src, tab, null),
      { src: srcB, tab: tabB }
    )

    expect(relA).toBe('./assets/a.png')
    expect(relB).toBe('./assets/b.png')

    const pathA = path.join(homedir(), '.wrangle', 'drafts', tabA, 'assets', 'a.png')
    const pathB = path.join(homedir(), '.wrangle', 'drafts', tabB, 'assets', 'b.png')
    await expect(access(pathA)).resolves.toBeUndefined()
    await expect(access(pathB)).resolves.toBeUndefined()

    // A's file must not live in B's dir, and vice versa.
    await expect(
      access(path.join(homedir(), '.wrangle', 'drafts', tabA, 'assets', 'b.png'))
    ).rejects.toThrow()
    await expect(
      access(path.join(homedir(), '.wrangle', 'drafts', tabB, 'assets', 'a.png'))
    ).rejects.toThrow()
  })

  test('temp directory hierarchy is created on demand before the copy', async ({ window }) => {
    const source = await fixtures.writeImage('ondemand.png')
    const tabId = makeTabId() // a brand-new tabId that cannot exist yet
    createdTabIds.push(tabId)

    // Precondition: the per-tab directory does not exist yet.
    const tempDir = path.join(homedir(), '.wrangle', 'drafts', tabId)
    await expect(access(tempDir)).rejects.toThrow()

    await window.evaluate(
      async ({ src, tab }) => window.electron.file.copyImage(src, tab, null),
      { src: source, tab: tabId }
    )

    await expect(access(path.join(tempDir, 'assets', 'ondemand.png'))).resolves.toBeUndefined()
  })
})
