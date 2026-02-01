import { Element } from 'hast'
import { ComponentPropsWithoutRef, ReactNode } from 'react'

/**
 * Extended props that react-markdown passes to custom renderers.
 * The `node` property contains the HAST element with our data-source-* attributes.
 * react-markdown also spreads the element's properties directly onto the props.
 */
export interface RendererProps<T extends keyof JSX.IntrinsicElements> extends ComponentPropsWithoutRef<T> {
  node?: Element
  children?: ReactNode
  // react-markdown spreads HAST properties directly onto props
  // These are converted from kebab-case to camelCase
  'data-source-start'?: number | string
  'data-source-end'?: number | string
  'data-text-start'?: number | string
  'data-text-end'?: number | string
}

/**
 * Extract source position attributes from renderer props.
 * react-markdown v9 spreads the hast properties directly onto the component props,
 * so we can access them directly from props rather than node.properties.
 */
export function getSourceAttrs(props: Record<string, unknown>): Record<string, number | string | undefined> {
  // Try direct props first (react-markdown spreads these)
  const directAttrs = {
    'data-source-start': props['data-source-start'] as number | string | undefined,
    'data-source-end': props['data-source-end'] as number | string | undefined,
    'data-text-start': props['data-text-start'] as number | string | undefined,
    'data-text-end': props['data-text-end'] as number | string | undefined,
  }

  // If direct props exist, return them
  if (directAttrs['data-source-start'] !== undefined) {
    return directAttrs
  }

  // Fallback: try to get from node.properties (older approach)
  const node = props.node as Element | undefined
  if (!node?.properties) return {}

  return {
    'data-source-start': node.properties['dataSourceStart'] as number | undefined,
    'data-source-end': node.properties['dataSourceEnd'] as number | undefined,
    'data-text-start': node.properties['dataTextStart'] as number | undefined,
    'data-text-end': node.properties['dataTextEnd'] as number | undefined,
  }
}
