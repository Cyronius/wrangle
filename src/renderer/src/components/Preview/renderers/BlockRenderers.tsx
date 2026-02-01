import React from 'react'
import { RendererProps, getSourceAttrs } from './types'

export function BlockquoteRenderer({ node, children, ...props }: RendererProps<'blockquote'>) {
  const sourceAttrs = getSourceAttrs({ node, ...props })

  return (
    <blockquote {...sourceAttrs} {...props}>
      {children}
    </blockquote>
  )
}

/**
 * Code block renderer (pre element).
 */
export function PreRenderer({ node, children, ...props }: RendererProps<'pre'>) {
  const sourceAttrs = getSourceAttrs({ node, ...props })

  return (
    <pre {...sourceAttrs} {...props}>
      {children}
    </pre>
  )
}

/**
 * Code element renderer for both code blocks and inline code.
 */
export function CodeRenderer({ node, children, className, ...props }: RendererProps<'code'> & { className?: string }) {
  const sourceAttrs = getSourceAttrs({ node, className, ...props })

  return (
    <code className={className} {...sourceAttrs} {...props}>
      {children}
    </code>
  )
}
