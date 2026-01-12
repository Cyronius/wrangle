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
 * Parse markdown and build source map by finding raw text positions
 */
export function buildSourceMapFromTokens(
  markdown: string,
  tokens: any[]
): SourceMap {
  const sourceMap = new SourceMap()
  let currentOffset = 0

  function processToken(token: any): void {
    // Find where this token's raw content appears in the source
    if (token.raw) {
      const index = markdown.indexOf(token.raw, currentOffset)
      if (index !== -1) {
        const id = sourceMap.addEntry(token.type, {
          start: index,
          end: index + token.raw.length
        })
        // Store the ID on the token for later use
        token._sourceId = id

        // Process child tokens if present
        if (token.tokens) {
          token.tokens.forEach((child: any) => processToken(child))
        }

        // For certain types, also process inline content
        if (token.items) {
          token.items.forEach((item: any) => {
            if (item.raw) {
              const itemIndex = markdown.indexOf(item.raw, currentOffset)
              if (itemIndex !== -1) {
                const itemId = sourceMap.addEntry('list_item', {
                  start: itemIndex,
                  end: itemIndex + item.raw.length
                })
                item._sourceId = itemId
              }
            }
            if (item.tokens) {
              item.tokens.forEach((child: any) => processToken(child))
            }
          })
        }
      }
    }
  }

  tokens.forEach(token => processToken(token))
  return sourceMap
}
