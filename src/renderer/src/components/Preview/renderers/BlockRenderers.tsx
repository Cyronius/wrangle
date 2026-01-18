import React from 'react'
import { TextWrapper } from './TextWrapper'
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
 * Code blocks are NOT made contentEditable since they have complex
 * syntax highlighting and we want to treat them as block-level elements.
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
 * Code element renderer that checks context.
 * When inside a pre (code block), don't wrap with TextWrapper.
 * For inline code, wrap with TextWrapper for cursor support.
 */
export function CodeRenderer({ node, children, className, ...props }: RendererProps<'code'> & { className?: string }) {
  const sourceAttrs = getSourceAttrs({ node, className, ...props })

  // If className contains 'language-', this is likely a code block (inside pre)
  // In that case, render without TextWrapper for better code display
  const isCodeBlock = className?.includes('language-') || className?.includes('hljs')

  if (isCodeBlock) {
    return (
      <code className={className} {...sourceAttrs} {...props}>
        {children}
      </code>
    )
  }

  // Inline code - wrap with TextWrapper
  return (
    <code className={className} {...sourceAttrs} {...props}>
      <TextWrapper>{children}</TextWrapper>
    </code>
  )
}
