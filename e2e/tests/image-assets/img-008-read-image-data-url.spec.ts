// Traces: IMG-008 (canonical spec: specs/image-assets/spec.md)
import { test, expect, waitForAppReady } from '../../fixtures'
import { ImageFixtureDir } from '../../helpers/image-fixture-helpers'
import path from 'path'

test.describe('IMG-008: Read Image as Data URL with MIME Detection', () => {
  let fixtures: ImageFixtureDir

  test.beforeEach(async ({ window }) => {
    await waitForAppReady(window)
    fixtures = await ImageFixtureDir.create('wrangle-img008-')
  })

  test.afterEach(async () => {
    await fixtures.cleanup()
  })

  test('returns data:image/png;base64,... for .png', async ({ window }) => {
    const p = await fixtures.writeImage('a.png', 'png')
    const result = await window.evaluate(
      async (imgPath) => window.electron.file.readImageAsDataURL(imgPath),
      p
    )
    expect(result).not.toBeNull()
    expect(result!.startsWith('data:image/png;base64,')).toBe(true)
  })

  test('maps .jpg and .jpeg both to image/jpeg', async ({ window }) => {
    const pJpg = await fixtures.writeImage('a.jpg', 'jpg')
    const pJpeg = await fixtures.writeImage('a.jpeg', 'jpeg')

    const jpg = await window.evaluate(
      async (imgPath) => window.electron.file.readImageAsDataURL(imgPath),
      pJpg
    )
    const jpeg = await window.evaluate(
      async (imgPath) => window.electron.file.readImageAsDataURL(imgPath),
      pJpeg
    )
    expect(jpg!.startsWith('data:image/jpeg;base64,')).toBe(true)
    expect(jpeg!.startsWith('data:image/jpeg;base64,')).toBe(true)
  })

  test('maps .gif, .svg, .webp to their respective MIME types', async ({ window }) => {
    const pGif = await fixtures.writeImage('a.gif', 'gif')
    const pSvg = await fixtures.writeImage('a.svg', 'svg')
    const pWebp = await fixtures.writeImage('a.webp', 'webp')

    const gif = await window.evaluate(
      async (imgPath) => window.electron.file.readImageAsDataURL(imgPath),
      pGif
    )
    const svg = await window.evaluate(
      async (imgPath) => window.electron.file.readImageAsDataURL(imgPath),
      pSvg
    )
    const webp = await window.evaluate(
      async (imgPath) => window.electron.file.readImageAsDataURL(imgPath),
      pWebp
    )

    expect(gif!.startsWith('data:image/gif;base64,')).toBe(true)
    expect(svg!.startsWith('data:image/svg+xml;base64,')).toBe(true)
    expect(webp!.startsWith('data:image/webp;base64,')).toBe(true)
  })

  test('defaults unknown extensions to image/png', async ({ window }) => {
    // Write a file with an unrecognized extension but valid PNG bytes.
    const p = await fixtures.writeImage('weird.bmp', 'png')
    const result = await window.evaluate(
      async (imgPath) => window.electron.file.readImageAsDataURL(imgPath),
      p
    )
    expect(result).not.toBeNull()
    expect(result!.startsWith('data:image/png;base64,')).toBe(true)
  })

  test('returns null on read error without showing a dialog', async ({ window }) => {
    const bogus = path.join(fixtures.dir, 'nope.png')
    const result = await window.evaluate(
      async (imgPath) => window.electron.file.readImageAsDataURL(imgPath),
      bogus
    )
    expect(result).toBeNull()
  })

  test('encodes the raw bytes as base64 payload', async ({ window }) => {
    const p = await fixtures.writeImage('check.png', 'png')
    const result = await window.evaluate(
      async (imgPath) => window.electron.file.readImageAsDataURL(imgPath),
      p
    )
    expect(result).not.toBeNull()
    const [header, payload] = result!.split(',')
    expect(header).toBe('data:image/png;base64')
    // base64 payload should round-trip to non-empty bytes.
    const decoded = Buffer.from(payload, 'base64')
    expect(decoded.length).toBeGreaterThan(0)
    // PNG signature bytes.
    expect(decoded[0]).toBe(0x89)
    expect(decoded[1]).toBe(0x50)
  })
})
