import { visit } from 'unist-util-visit'
import type { Root, Element, Text } from 'hast'

/**
 * Rehype plugin that adds data-source-start and data-source-end attributes
 * to elements based on their position data.
 *
 * Also adds data-text-start and data-text-end for elements with children,
 * indicating where the actual text content begins and ends in the source.
 *
 * This runs on the hast (HTML AST) tree, which means it works after
 * remark-rehype conversion and can survive sanitization if added as a
 * rehype plugin after sanitization.
 */
export function rehypeSourcePositions() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element) => {
      if (node.position) {
        node.properties = node.properties || {}
        node.properties['data-source-start'] = node.position.start.offset
        node.properties['data-source-end'] = node.position.end.offset

        // For elements with children, find where text content starts/ends
        if (node.children && node.children.length > 0) {
          // Find first child with position
          for (const child of node.children) {
            if (child.position) {
              node.properties['data-text-start'] = child.position.start.offset
              break
            }
          }

          // Find last child with position
          for (let i = node.children.length - 1; i >= 0; i--) {
            const child = node.children[i]
            if (child.position) {
              node.properties['data-text-end'] = child.position.end.offset
              break
            }
          }
        }
      }
    })
  }
}
