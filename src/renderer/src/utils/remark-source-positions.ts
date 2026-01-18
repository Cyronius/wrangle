import { visit } from 'unist-util-visit'
import type { Root, Node, Parent, Literal } from 'mdast'

// Extend Node to include data property
interface NodeWithData extends Node {
  data?: {
    hProperties?: Record<string, unknown>
    [key: string]: unknown
  }
  children?: NodeWithData[]
  value?: string
}

/**
 * Remark plugin that adds data-source-start and data-source-end
 * attributes to all nodes. These attributes will be preserved
 * when remark-rehype converts to HTML via the hProperties mechanism.
 *
 * For elements with inline formatting (like strong, emphasis, etc.),
 * we also add data-text-start and data-text-end to indicate where
 * the actual text content begins and ends within the source range.
 * This allows accurate character-level cursor positioning even when
 * markdown syntax is present.
 */
export function remarkSourcePositions() {
  return (tree: Root) => {
    visit(tree, (node: NodeWithData, _index, parent: Parent | undefined) => {
      if (!node.position) return

      // hProperties will be transferred to HTML attributes by remark-rehype
      node.data = node.data || {}
      node.data.hProperties = node.data.hProperties || {}
      node.data.hProperties['data-source-start'] = node.position.start.offset
      node.data.hProperties['data-source-end'] = node.position.end.offset

      // For parent nodes with children, calculate where the text content starts
      // by looking at the first text child's position
      if ('children' in node && Array.isArray(node.children) && node.children.length > 0) {
        const firstChild = node.children[0] as NodeWithData
        const lastChild = node.children[node.children.length - 1] as NodeWithData

        // If first child has position data, that's where text content starts
        if (firstChild.position) {
          node.data.hProperties['data-text-start'] = firstChild.position.start.offset
        }

        // If last child has position data, that's where text content ends
        if (lastChild.position) {
          node.data.hProperties['data-text-end'] = lastChild.position.end.offset
        }
      }

      // For text nodes (literals), text-start equals source-start
      // Special handling for inline code which has backticks
      if ('value' in node && typeof node.value === 'string') {
        if (node.type === 'inlineCode') {
          // Inline code: `code` - text starts after ` and ends before `
          node.data.hProperties['data-text-start'] = node.position.start.offset! + 1
          node.data.hProperties['data-text-end'] = node.position.end.offset! - 1
        } else {
          node.data.hProperties['data-text-start'] = node.position.start.offset
          node.data.hProperties['data-text-end'] = node.position.end.offset
        }
      }
    })
  }
}
