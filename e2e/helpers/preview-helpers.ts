import { Page } from '@playwright/test'

/**
 * Helper class for preview pane interactions
 */
export class PreviewHelpers {
  constructor(private page: Page) {}

  /**
   * Click at specific coordinates within the preview pane
   */
  async clickAtCoordinates(x: number, y: number): Promise<void> {
    const previewBounds = await this.page.$eval('.markdown-preview', (el) => {
      const rect = el.getBoundingClientRect()
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
    })

    // Click at the specified coordinates relative to preview
    await this.page.mouse.click(previewBounds.x + x, previewBounds.y + y)
  }

  /**
   * Click on a specific element in the preview
   */
  async clickOnElement(selector: string): Promise<{ x: number; y: number }> {
    const element = await this.page.$(`.markdown-preview ${selector}`)
    if (!element) {
      throw new Error(`Element not found: ${selector}`)
    }

    const bounds = await element.boundingBox()
    if (!bounds) {
      throw new Error(`Could not get bounds for element: ${selector}`)
    }

    // Click in the center of the element
    const x = bounds.x + bounds.width / 2
    const y = bounds.y + bounds.height / 2
    await this.page.mouse.click(x, y)

    return { x, y }
  }

  /**
   * Get position of the pseudo-cursor overlay
   */
  async getPseudoCursorPosition(): Promise<{ top: number; left: number; height: number } | null> {
    return this.page.evaluate(() => {
      const cursor = document.querySelector('.pseudo-cursor-overlay')
      if (!cursor) return null

      const style = cursor.getAttribute('style') || ''
      const topMatch = style.match(/top:\s*([0-9.]+)px/)
      const leftMatch = style.match(/left:\s*([0-9.]+)px/)
      const heightMatch = style.match(/height:\s*([0-9.]+)px/)

      if (!topMatch || !leftMatch || !heightMatch) return null

      return {
        top: parseFloat(topMatch[1]),
        left: parseFloat(leftMatch[1]),
        height: parseFloat(heightMatch[1])
      }
    })
  }

  /**
   * Check if the pseudo-cursor is visible
   */
  async isPseudoCursorVisible(): Promise<boolean> {
    const cursor = await this.page.$('.pseudo-cursor-overlay')
    if (!cursor) return false

    const isVisible = await cursor.isVisible()
    return isVisible
  }

  /**
   * Wait for pseudo-cursor to appear
   */
  async waitForPseudoCursor(timeout = 5000): Promise<void> {
    await this.page.waitForSelector('.pseudo-cursor-overlay', {
      state: 'visible',
      timeout
    })
  }

  /**
   * Wait for pseudo-cursor to disappear
   */
  async waitForPseudoCursorHidden(timeout = 5000): Promise<void> {
    await this.page.waitForSelector('.pseudo-cursor-overlay', {
      state: 'hidden',
      timeout
    })
  }

  /**
   * Verify pseudo-cursor is continuously visible for a duration
   * This tests for flicker/disappearance bugs
   */
  async verifyPseudoCursorStability(
    durationMs: number = 2000,
    checkIntervalMs: number = 100
  ): Promise<{ stable: boolean; missingAt?: number }> {
    const startTime = Date.now()

    while (Date.now() - startTime < durationMs) {
      const isVisible = await this.isPseudoCursorVisible()

      if (!isVisible) {
        return {
          stable: false,
          missingAt: Date.now() - startTime
        }
      }

      await this.page.waitForTimeout(checkIntervalMs)
    }

    return { stable: true }
  }

  /**
   * Get the highlighted element in the preview (source-highlight class)
   */
  async getHighlightedElement(): Promise<string | null> {
    return this.page.evaluate(() => {
      const highlighted = document.querySelector('.markdown-body .source-highlight')
      if (!highlighted) return null
      return highlighted.getAttribute('data-source-id')
    })
  }

  /**
   * Get element by data-source-id
   */
  async getElementBySourceId(sourceId: string): Promise<{
    bounds: { x: number; y: number; width: number; height: number }
    tagName: string
    text: string
  } | null> {
    return this.page.evaluate((id) => {
      const el = document.querySelector(`[data-source-id="${id}"]`) as HTMLElement
      if (!el) return null

      const rect = el.getBoundingClientRect()
      return {
        bounds: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        tagName: el.tagName.toLowerCase(),
        text: el.textContent || ''
      }
    }, sourceId)
  }

  /**
   * Scroll the preview pane
   */
  async scrollTo(scrollTop: number): Promise<void> {
    await this.page.evaluate((top) => {
      const preview = document.querySelector('.markdown-preview')
      if (preview) {
        preview.scrollTop = top
      }
    }, scrollTop)
  }

  /**
   * Get current scroll position of preview
   */
  async getScrollPosition(): Promise<number> {
    return this.page.evaluate(() => {
      const preview = document.querySelector('.markdown-preview')
      return preview?.scrollTop || 0
    })
  }

  /**
   * Get all elements with data-source-id in the preview
   */
  async getSourceMappedElements(): Promise<Array<{ id: string; tagName: string }>> {
    return this.page.evaluate(() => {
      const elements = document.querySelectorAll('[data-source-id]')
      return Array.from(elements).map((el) => ({
        id: el.getAttribute('data-source-id') || '',
        tagName: el.tagName.toLowerCase()
      }))
    })
  }

  /**
   * Click on specific text at a given offset within that text.
   * Uses DOM Range API to find the exact character position.
   * Searches across ALL matching elements (not just the first one).
   *
   * @param elementSelector - CSS selector for the containing element (e.g., 'p', 'h1')
   *                         Use '*' to search anywhere in the preview
   * @param searchText - The text to find within the element
   * @param offsetInText - Character offset within the found text to click (0 = before first char)
   */
  async clickOnTextAtOffset(
    elementSelector: string,
    searchText: string,
    offsetInText: number
  ): Promise<void> {
    const position = await this.page.evaluate(
      ({ selector, text, offset }) => {
        // Search across ALL matching elements
        const baseSelector = selector === '*' ? '.markdown-preview' : `.markdown-preview ${selector}`
        const elements = document.querySelectorAll(baseSelector)
        if (elements.length === 0) return null

        for (const element of elements) {
          const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null)
          while (walker.nextNode()) {
            const textNode = walker.currentNode as Text
            const content = textNode.textContent || ''
            const textIndex = content.indexOf(text)

            if (textIndex !== -1) {
              const targetOffset = textIndex + Math.min(offset, text.length)
              const range = document.createRange()
              // Create a range that spans the target character (not just the insertion point)
              // This gives us the actual character bounds to click in the center of
              range.setStart(textNode, targetOffset)
              const endOffset = Math.min(targetOffset + 1, textNode.length)
              range.setEnd(textNode, endOffset)
              const rect = range.getBoundingClientRect()
              // Click in the center of the character (not just a few pixels from the left edge)
              return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
            }
          }
        }
        return null
      },
      { selector: elementSelector, text: searchText, offset: offsetInText }
    )

    if (!position) {
      throw new Error(`Could not find text "${searchText}" in ${elementSelector}`)
    }

    await this.page.mouse.click(position.x, position.y)
  }

  /**
   * Click at a specific character index within an element's text content.
   * This is useful when you want to click at an absolute position rather than
   * searching for specific text.
   *
   * @param elementSelector - CSS selector for the element
   * @param charIndex - Character index (0-based) to click at
   */
  async clickAtCharIndex(elementSelector: string, charIndex: number): Promise<void> {
    const position = await this.page.evaluate(
      ({ selector, index }) => {
        const element = document.querySelector(`.markdown-preview ${selector}`)
        if (!element) return null

        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null)
        let currentIndex = 0

        while (walker.nextNode()) {
          const textNode = walker.currentNode as Text
          const nodeLength = textNode.textContent?.length || 0

          if (currentIndex + nodeLength > index) {
            // Target is within this text node
            const localOffset = index - currentIndex
            const range = document.createRange()
            range.setStart(textNode, localOffset)
            range.setEnd(textNode, localOffset)
            const rect = range.getBoundingClientRect()
            return { x: rect.left + 1, y: rect.top + rect.height / 2 }
          }

          currentIndex += nodeLength
        }

        return null
      },
      { selector: elementSelector, index: charIndex }
    )

    if (!position) {
      throw new Error(`Could not find character index ${charIndex} in ${elementSelector}`)
    }

    await this.page.mouse.click(position.x, position.y)
  }
}
