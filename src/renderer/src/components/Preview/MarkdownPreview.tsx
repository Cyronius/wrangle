import { useEffect, useRef, useState } from 'react'
import { renderMarkdown, initializeMermaid } from '../../utils/markdown-renderer'
import './preview.css'

interface MarkdownPreviewProps {
  content: string
  baseDir?: string | null
  syncScroll?: boolean
  onScroll?: (scrollRatio: number) => void
}

export function MarkdownPreview({
  content,
  baseDir = null,
  syncScroll = false,
  onScroll
}: MarkdownPreviewProps) {
  const [html, setHtml] = useState('')
  const previewRef = useRef<HTMLDivElement>(null)
  const isScrollingRef = useRef(false)

  // Initialize Mermaid on mount
  useEffect(() => {
    initializeMermaid()
  }, [])

  // Render markdown whenever content or baseDir changes
  useEffect(() => {
    const render = async () => {
      const rendered = await renderMarkdown(content, baseDir)
      setHtml(rendered)
    }
    render()
  }, [content, baseDir])

  // Handle scroll synchronization
  useEffect(() => {
    if (!syncScroll || !previewRef.current || !onScroll) return

    const handleScroll = () => {
      if (isScrollingRef.current) return

      const element = previewRef.current
      if (!element) return

      const scrollRatio =
        element.scrollTop / (element.scrollHeight - element.clientHeight) || 0

      onScroll(scrollRatio)
    }

    const element = previewRef.current
    element.addEventListener('scroll', handleScroll)

    return () => {
      element.removeEventListener('scroll', handleScroll)
    }
  }, [syncScroll, onScroll])

  // External scroll (from editor)
  useEffect(() => {
    if (!previewRef.current) return

    const element = previewRef.current

    // This will be called when parent wants to sync preview scroll
    ;(element as any).scrollToRatio = (ratio: number) => {
      isScrollingRef.current = true
      const maxScroll = element.scrollHeight - element.clientHeight
      element.scrollTop = maxScroll * ratio

      setTimeout(() => {
        isScrollingRef.current = false
      }, 100)
    }
  }, [])

  return (
    <div ref={previewRef} className="markdown-preview">
      <div
        className="markdown-body"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}
