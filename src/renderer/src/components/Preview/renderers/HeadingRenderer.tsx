import React from 'react'
import { RendererProps, getSourceAttrs } from './types'

function createHeadingRenderer(level: 1 | 2 | 3 | 4 | 5 | 6) {
  const Tag = `h${level}` as const

  return function HeadingRenderer({ node, children, ...props }: RendererProps<typeof Tag>) {
    const sourceAttrs = getSourceAttrs({ node, ...props })

    return React.createElement(
      Tag,
      { ...sourceAttrs, ...props },
      children
    )
  }
}

export const H1Renderer = createHeadingRenderer(1)
export const H2Renderer = createHeadingRenderer(2)
export const H3Renderer = createHeadingRenderer(3)
export const H4Renderer = createHeadingRenderer(4)
export const H5Renderer = createHeadingRenderer(5)
export const H6Renderer = createHeadingRenderer(6)
