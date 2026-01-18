/**
 * Source mapping between markdown tokens and rendered HTML elements
 */

export interface SourceRange {
  start: number  // Character offset in source
  end: number    // Character offset in source
}

export interface SourceMapEntry {
  id: string           // Unique element ID (e.g., "src-0")
  type: string         // Token type: 'paragraph', 'heading', 'strong', etc.
  sourceRange: SourceRange
}

export class SourceMap {
  private entries: Map<string, SourceMapEntry> = new Map()
  private idCounter = 0

  /**
   * Add a source map entry
   */
  addEntry(type: string, sourceRange: SourceRange): string {
    const id = `src-${this.idCounter++}`
    this.entries.set(id, { id, type, sourceRange })
    return id
  }

  /**
   * Get the full entry for an element ID
   */
  getEntry(elementId: string): SourceMapEntry | null {
    return this.entries.get(elementId) ?? null
  }

  /**
   * Get source range for an element ID
   */
  getRange(elementId: string): SourceRange | null {
    const entry = this.entries.get(elementId)
    return entry?.sourceRange ?? null
  }

  /**
   * Find the element ID that contains the given source offset
   */
  findElementByOffset(offset: number): string | null {
    for (const [id, entry] of this.entries) {
      if (offset >= entry.sourceRange.start && offset < entry.sourceRange.end) {
        return id
      }
    }
    return null
  }

  /**
   * Find all entries that overlap with a given range.
   * Used for selection highlighting.
   */
  findEntriesInRange(start: number, end: number): Array<{
    elementId: string
    entry: SourceMapEntry
    overlapStart: number  // Local offset where overlap starts
    overlapEnd: number    // Local offset where overlap ends
  }> {
    const results: Array<{
      elementId: string
      entry: SourceMapEntry
      overlapStart: number
      overlapEnd: number
    }> = []

    for (const [id, entry] of this.entries) {
      const entryStart = entry.sourceRange.start
      const entryEnd = entry.sourceRange.end

      // Check if ranges overlap
      if (start < entryEnd && end > entryStart) {
        // Calculate the overlap within this entry's local coordinates
        const overlapStart = Math.max(0, start - entryStart)
        const overlapEnd = Math.min(entryEnd - entryStart, end - entryStart)

        results.push({
          elementId: id,
          entry,
          overlapStart,
          overlapEnd
        })
      }
    }

    return results
  }

  /**
   * Get all entries
   */
  getAllEntries(): Map<string, SourceMapEntry> {
    return this.entries
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.entries.clear()
    this.idCounter = 0
  }

  /**
   * Get the number of entries
   */
  get size(): number {
    return this.entries.size
  }
}

/**
 * Build a source map by walking the rendered DOM and extracting
 * data-source-start and data-source-end attributes.
 *
 * This is used after Streamdown renders the markdown to HTML,
 * since the position data is injected by our remarkSourcePositions plugin.
 */
export function buildSourceMapFromDOM(container: HTMLElement): SourceMap {
  const sourceMap = new SourceMap()
  const elements = container.querySelectorAll('[data-source-start]')

  elements.forEach((el) => {
    const startAttr = el.getAttribute('data-source-start')
    const endAttr = el.getAttribute('data-source-end')

    if (startAttr !== null && endAttr !== null) {
      const start = parseInt(startAttr, 10)
      const end = parseInt(endAttr, 10)
      const type = el.tagName.toLowerCase()

      sourceMap.addEntry(type, { start, end })
    }
  })

  return sourceMap
}
