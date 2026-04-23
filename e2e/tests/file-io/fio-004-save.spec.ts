// Traces: FIO-004 (canonical spec: specs/file-io/spec.md)
import { test, expect } from '../../fixtures'
import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'

let tmpDir: string

test.describe('FIO-004: Save To Known Path', () => {
  test.beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wrangle-fio004-'))
  })

  test.afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
  })

  test('saving to a known path writes the content and returns true', async ({
    window,
    electronApp
  }) => {
    const filePath = path.join(tmpDir, 'save-me.md')
    const content = '# Saved content\nLine 2\n'

    // Ensure showErrorBox stays a no-op in case of failure during test.
    await electronApp.evaluate(async ({ dialog }) => {
      ;(dialog as unknown as { showErrorBox: typeof dialog.showErrorBox }).showErrorBox =
        (() => undefined) as typeof dialog.showErrorBox
    })

    const result = await window.evaluate(
      ({ p, c }) => window.electron.file.save(p, c),
      { p: filePath, c: content }
    )

    expect(result).toBe(true)
    const onDisk = await fs.readFile(filePath, 'utf-8')
    expect(onDisk).toBe(content)
  })

  test('saving to an invalid path returns false and triggers error dialog', async ({
    window,
    electronApp
  }) => {
    // Non-existent parent directory → fs.writeFile rejects with ENOENT.
    const bogusPath = path.join(tmpDir, 'does-not-exist-dir', 'file.md')

    // Stub showErrorBox to observe the call without blocking the UI.
    const captured = await electronApp.evaluate(async ({ dialog }) => {
      const calls: Array<{ title: string; content: string }> = []
      ;(dialog as unknown as { showErrorBox: typeof dialog.showErrorBox }).showErrorBox = ((
        title: string,
        content: string
      ) => {
        calls.push({ title, content })
      }) as typeof dialog.showErrorBox
      ;(globalThis as unknown as { __fio004Calls: typeof calls }).__fio004Calls = calls
      return true
    })
    expect(captured).toBe(true)

    const result = await window.evaluate(
      ({ p, c }) => window.electron.file.save(p, c),
      { p: bogusPath, c: 'anything' }
    )
    expect(result).toBe(false)

    const calls = await electronApp.evaluate(async () => {
      return (
        (globalThis as unknown as { __fio004Calls: Array<{ title: string; content: string }> })
          .__fio004Calls || []
      )
    })
    expect(calls.length).toBeGreaterThan(0)
    expect(calls[0].title).toBe('File Save Error')
  })

  test('unicode content round-trips as UTF-8', async ({ window }) => {
    const filePath = path.join(tmpDir, 'unicode.md')
    const content = 'αβγ — 🎉 — 日本語 — café\n'

    const result = await window.evaluate(
      ({ p, c }) => window.electron.file.save(p, c),
      { p: filePath, c: content }
    )
    expect(result).toBe(true)

    const onDisk = await fs.readFile(filePath, 'utf-8')
    expect(onDisk).toBe(content)

    // Also check the raw bytes round-trip (no BOM, proper UTF-8 encoding)
    const rawBytes = await fs.readFile(filePath)
    expect(rawBytes).toEqual(Buffer.from(content, 'utf-8'))
  })
})
