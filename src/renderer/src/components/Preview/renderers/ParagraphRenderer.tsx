import React from 'react'
import { TextWrapper } from './TextWrapper'
import { RendererProps, getSourceAttrs } from './types'

export function ParagraphRenderer({ node, children, ...props }: RendererProps<'p'>) {
  const sourceAttrs = getSourceAttrs({ node, ...props })

  return (
    <p {...sourceAttrs} {...props}>
      <TextWrapper>{children}</TextWrapper>
    </p>
  )
}
