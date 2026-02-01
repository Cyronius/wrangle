import React from 'react'
import { RendererProps, getSourceAttrs } from './types'

export function ParagraphRenderer({ node, children, ...props }: RendererProps<'p'>) {
  const sourceAttrs = getSourceAttrs({ node, ...props })

  return (
    <p {...sourceAttrs} {...props}>
      {children}
    </p>
  )
}
