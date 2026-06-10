// Traces: FIO-007 (canonical spec: specs/file-io/spec.md)
//
// Property under test: getFilePathFromArgs locates the OS-supplied file path
// regardless of build packaging. Electron's argv has different leading entries
// when packaged ([exe, <file>]) vs unpackaged ([electron, mainScript, <file>]).
// The packaged case is the regression: slicing a fixed offset of 2 dropped the
// file path at argv[1], so opening a .md from Explorer launched the app with no
// file loaded.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { getFilePathFromArgs } from '../../../src/main/utils/cli-args'

describe('FIO-007: argv offset is packaging-aware', () => {
  let dir: string
  let mdFile: string
  let otherMdFile: string
  let pngFile: string

  beforeAll(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'wrangle-cli-args-'))
    mdFile = path.join(dir, 'note.md')
    otherMdFile = path.join(dir, 'other.md')
    pngFile = path.join(dir, 'image.png')
    writeFileSync(mdFile, '# hi\n', 'utf-8')
    writeFileSync(otherMdFile, '# other\n', 'utf-8')
    writeFileSync(pngFile, 'not really a png', 'utf-8')
  })

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('packaged argv: file path at index 1 is found', () => {
    // [exe, <file>] — the regression case.
    expect(getFilePathFromArgs(['C:/Apps/Wrangle.exe', mdFile], true)).toBe(mdFile)
  })

  it('unpackaged argv: file path at index 2 is found', () => {
    // [electron, mainScript, <file>]
    expect(getFilePathFromArgs(['electron.exe', 'out/main/index.js', mdFile], false)).toBe(mdFile)
  })

  it('unpackaged argv: the entry at index 1 is NOT treated as the file', () => {
    // The main-script slot (index 1) can itself be a real, text-whitelisted
    // path on disk in dev (e.g. out/main/index.js). It must be skipped — only
    // args from index 2 count. Distinct files at 1 and 2 prove the offset.
    expect(getFilePathFromArgs(['electron.exe', otherMdFile, mdFile], false)).toBe(mdFile)
  })

  it('packaged argv: leading flags are skipped, file still found', () => {
    expect(getFilePathFromArgs(['Wrangle.exe', '--some-flag', mdFile], true)).toBe(mdFile)
  })

  it('non-text file (png) is rejected', () => {
    expect(getFilePathFromArgs(['Wrangle.exe', pngFile], true)).toBeNull()
  })

  it('nonexistent path is rejected', () => {
    const missing = path.join(dir, 'gone.md')
    expect(getFilePathFromArgs(['Wrangle.exe', missing], true)).toBeNull()
  })

  it('no file argument returns null', () => {
    expect(getFilePathFromArgs(['Wrangle.exe'], true)).toBeNull()
    expect(getFilePathFromArgs(['electron.exe', 'out/main/index.js'], false)).toBeNull()
  })
})
