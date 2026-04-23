// Traces: FIO-002 (canonical spec: specs/file-io/spec.md)
import { test, expect } from '../../fixtures'
import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'

let tmpDir: string

test.describe('FIO-002: Binary File Detection', () => {
  test.beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wrangle-fio002-'))
  })

  test.afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
  })

  test('.md file is classified as text (whitelisted extension)', async ({ window }) => {
    const filePath = path.join(tmpDir, 'note.md')
    await fs.writeFile(filePath, '# Hello\n', 'utf-8')

    const result = await window.evaluate(
      (p) => window.electron.file.readByPath(p),
      filePath
    )

    expect(result).not.toBeNull()
    expect(result).not.toHaveProperty('error')
    expect((result as { path: string; content: string }).path).toBe(filePath)
    expect((result as { path: string; content: string }).content).toBe('# Hello\n')
  })

  test('.png file is classified as binary via null-byte scan', async ({ window }) => {
    // Minimal valid PNG signature contains null bytes within the first 8KB
    const pngSignature = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00
    ])
    const filePath = path.join(tmpDir, 'image.png')
    await fs.writeFile(filePath, pngSignature)

    const result = await window.evaluate(
      (p) => window.electron.file.readByPath(p),
      filePath
    )

    expect(result).toEqual({ error: 'binary' })
  })

  test('extensionless ASCII-only file is classified as text', async ({ window }) => {
    const filePath = path.join(tmpDir, 'README')
    await fs.writeFile(filePath, 'Plain ASCII content with no null bytes.\n', 'utf-8')

    const result = await window.evaluate(
      (p) => window.electron.file.readByPath(p),
      filePath
    )

    expect(result).not.toBeNull()
    expect(result).not.toHaveProperty('error')
    expect((result as { content: string }).content).toBe(
      'Plain ASCII content with no null bytes.\n'
    )
  })

  test('extensionless file with a null byte in first 8KB is classified as binary', async ({
    window
  }) => {
    const buf = Buffer.concat([
      Buffer.from('some text before the null '),
      Buffer.from([0x00]),
      Buffer.from(' and some after')
    ])
    const filePath = path.join(tmpDir, 'binblob')
    await fs.writeFile(filePath, buf)

    const result = await window.evaluate(
      (p) => window.electron.file.readByPath(p),
      filePath
    )

    expect(result).toEqual({ error: 'binary' })
  })
})
