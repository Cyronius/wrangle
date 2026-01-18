import React from 'react'
import { TextWrapper } from './TextWrapper'
import { RendererProps, getSourceAttrs } from './types'

export function UlRenderer({ node, children, ...props }: RendererProps<'ul'>) {
  const sourceAttrs = getSourceAttrs({ node, ...props })

  return (
    <ul {...sourceAttrs} {...props}>
      {children}
    </ul>
  )
}

export function OlRenderer({ node, children, ...props }: RendererProps<'ol'>) {
  const sourceAttrs = getSourceAttrs({ node, ...props })

  return (
    <ol {...sourceAttrs} {...props}>
      {children}
    </ol>
  )
}

export function LiRenderer({ node, children, ...props }: RendererProps<'li'>) {
  const sourceAttrs = getSourceAttrs({ node, ...props })

  return (
    <li {...sourceAttrs} {...props}>
      <TextWrapper>{children}</TextWrapper>
    </li>
  )
}
