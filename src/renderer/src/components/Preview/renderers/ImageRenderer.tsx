import React, { useEffect, useState } from 'react'
import { RendererProps, getSourceAttrs } from './types'

interface ImageRendererProps extends RendererProps<'img'> {
  baseDir: string | null
}

/**
 * Creates an image component that handles relative path resolution.
 * Relative paths (./assets/image.png) are converted to data URLs via IPC.
 */
export function createImageRenderer(baseDir: string | null) {
  return function ImageRenderer({ node, src, alt, ...props }: ImageRendererProps) {
    const [imageSrc, setImageSrc] = useState<string | undefined>(src)
    const sourceAttrs = getSourceAttrs({ node, src, alt, ...props })

    useEffect(() => {
      async function loadImage() {
        if (!src || !baseDir || !src.startsWith('./')) {
          setImageSrc(src)
          return
        }

        try {
          // Remove leading ./
          const relativePath = src.substring(2)
          // Combine with base directory (use platform-specific path separator)
          const absolutePath = `${baseDir}\\${relativePath.replace(/\//g, '\\')}`

          // Read image as data URL through IPC
          const dataURL = await window.electron.file.readImageAsDataURL(absolutePath)
          if (dataURL) {
            setImageSrc(dataURL)
          }
        } catch (error) {
          console.error('[ImageRenderer] Error loading image:', error)
        }
      }

      loadImage()
    }, [src])

    return <img src={imageSrc} alt={alt || ''} {...sourceAttrs} {...props} />
  }
}
