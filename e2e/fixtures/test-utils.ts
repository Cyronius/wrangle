import { Page } from '@playwright/test'

/**
 * Wait for Monaco editor to be fully initialized and ready
 */
export async function waitForMonacoReady(page: Page, timeout = 30000): Promise<void> {
  // Wait for Monaco editor container to be visible
  await page.waitForSelector('.monaco-editor', { state: 'visible', timeout })

  // Wait for the editor to be interactive (has lines)
  await page.waitForSelector('.monaco-editor .view-lines', { state: 'visible', timeout })

  // Additional wait for editor to be fully initialized
  await page.waitForFunction(
    () => {
      const editor = document.querySelector('.monaco-editor')
      return editor && !editor.classList.contains('loading')
    },
    { timeout }
  )
}

/**
 * Wait for the markdown preview to render
 */
export async function waitForPreviewReady(page: Page, timeout = 10000): Promise<void> {
  await page.waitForSelector('.markdown-preview', { state: 'visible', timeout })
  // Note: .markdown-body may be empty/hidden if no content, so just check it exists
  await page.waitForSelector('.markdown-body', { state: 'attached', timeout })
}

/**
 * Wait for the entire app to be ready (editor + preview in split mode)
 */
export async function waitForAppReady(page: Page, timeout = 30000): Promise<void> {
  // Wait for Monaco editor
  await waitForMonacoReady(page, timeout)

  // Wait for preview (if in split mode)
  const preview = await page.$('.markdown-preview')
  if (preview) {
    await waitForPreviewReady(page, timeout)
  }
}

/**
 * Get the bounding box of an element relative to the viewport
 */
export async function getElementBounds(
  page: Page,
  selector: string
): Promise<{
  x: number
  y: number
  width: number
  height: number
} | null> {
  const element = await page.$(selector)
  if (!element) return null
  return element.boundingBox()
}

/**
 * Check if an element is visible within its container
 */
export async function isElementVisibleInContainer(
  page: Page,
  elementSelector: string,
  containerSelector: string
): Promise<boolean> {
  return page.evaluate(
    ({ elem, container }) => {
      const el = document.querySelector(elem)
      const cont = document.querySelector(container)
      if (!el || !cont) return false

      const elRect = el.getBoundingClientRect()
      const contRect = cont.getBoundingClientRect()

      return (
        elRect.top >= contRect.top &&
        elRect.bottom <= contRect.bottom &&
        elRect.left >= contRect.left &&
        elRect.right <= contRect.right
      )
    },
    { elem: elementSelector, container: containerSelector }
  )
}

/**
 * Sleep helper for debugging
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
