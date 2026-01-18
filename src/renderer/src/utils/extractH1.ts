/**
 * Extract the first H1 heading from markdown content.
 * Uses regex for simplicity - doesn't need full markdown parsing.
 */
export function extractH1(content: string): string | null {
  // Match first line starting with single # followed by space
  const match = content.match(/^#\s+(.+)$/m)
  return match ? match[1].trim() : null
}
