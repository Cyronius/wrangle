import React from 'react'
import { TextWrapper } from './TextWrapper'
import { RendererProps, getSourceAttrs } from './types'

export function StrongRenderer({ node, children, ...props }: RendererProps<'strong'>) {
  const sourceAttrs = getSourceAttrs({ node, ...props })

  return (
    <strong {...sourceAttrs} {...props}>
      <TextWrapper>{children}</TextWrapper>
    </strong>
  )
}

export function EmRenderer({ node, children, ...props }: RendererProps<'em'>) {
  const sourceAttrs = getSourceAttrs({ node, ...props })

  return (
    <em {...sourceAttrs} {...props}>
      <TextWrapper>{children}</TextWrapper>
    </em>
  )
}

export function DelRenderer({ node, children, ...props }: RendererProps<'del'>) {
  const sourceAttrs = getSourceAttrs({ node, ...props })

  return (
    <del {...sourceAttrs} {...props}>
      <TextWrapper>{children}</TextWrapper>
    </del>
  )
}

export function InlineCodeRenderer({ node, children, ...props }: RendererProps<'code'>) {
  const sourceAttrs = getSourceAttrs({ node, ...props })

  // Check if this is inside a <pre> (code block) - if so, don't wrap
  // The parent check happens at the component level via the 'pre' renderer
  return (
    <code {...sourceAttrs} {...props}>
      <TextWrapper>{children}</TextWrapper>
    </code>
  )
}
