// Traces: FIO-003 (canonical spec: specs/file-io/spec.md)
import { test, expect } from '../../fixtures'
import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'

let tmpDir: string

test.describe('FIO-003: Read File By Path', () => {
  test.beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wrangle-fio003-'))
  })

  test.afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
  })

  test('valid markdown path returns FileData with UTF-8 content', async ({ window }) => {
    const filePath = path.join(tmpDir, 'doc.md')
    const content = 'Unicode test: αβγ — 🎉 — 日本語\n'
    await fs.writeFile(filePath, content, 'utf-8')

    const result = await window.evaluate(
      (p) => window.electron.file.readByPath(p),
      filePath
    )

    expect(result).not.toBeNull()
    expect(result).toEqual({ path: filePath, content })
  })

  test('PNG path returns { error: "binary" }', async ({ window }) => {
    const filePath = path.join(tmpDir, 'pic.png')
    // PNG header guarantees null bytes in first 8KB
    await fs.writeFile(
      filePath,
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d])
    )

    const result = await window.evaluate(
      (p) => window.electron.file.readByPath(p),
      filePath
    )

    expect(result).toEqual({ error: 'binary' })
  })

  test('non-existent path returns null', async ({ window }) => {
    const missing = path.join(tmpDir, 'does-not-exist.md')

    const result = await window.evaluate(
      (p) => window.electron.file.readByPath(p),
      missing
    )

    expect(result).toBeNull()
  })
})
