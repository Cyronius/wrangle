import React from 'react'
import { RendererProps, getSourceAttrs } from './types'

export function StrongRenderer({ node, children, ...props }: RendererProps<'strong'>) {
  const sourceAttrs = getSourceAttrs({ node, ...props })

  return (
    <strong {...sourceAttrs} {...props}>
      {children}
    </strong>
  )
}

export function EmRenderer({ node, children, ...props }: RendererProps<'em'>) {
  const sourceAttrs = getSourceAttrs({ node, ...props })

  return (
    <em {...sourceAttrs} {...props}>
      {children}
    </em>
  )
}

export function DelRenderer({ node, children, ...props }: RendererProps<'del'>) {
  const sourceAttrs = getSourceAttrs({ node, ...props })

  return (
    <del {...sourceAttrs} {...props}>
      {children}
    </del>
  )
}

export function InlineCodeRenderer({ node, children, ...props }: RendererProps<'code'>) {
  const sourceAttrs = getSourceAttrs({ node, ...props })

  return (
    <code {...sourceAttrs} {...props}>
      {children}
    </code>
  )
}
