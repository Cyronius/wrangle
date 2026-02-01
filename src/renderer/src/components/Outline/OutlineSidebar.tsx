import { useState, useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { toggleOutline } from '../../store/layoutSlice'
import { marked } from 'marked'
import * as monaco from 'monaco-editor'
import './outline.css'

interface OutlineItem {
  id: string
  level: number // 1-6
  text: string
  lineNumber: number
}

interface OutlineSidebarProps {
  content: string
  editorRef: React.RefObject<monaco.editor.IStandaloneCodeEditor | null>
}

export function OutlineSidebar({ content, editorRef }: OutlineSidebarProps) {
  const dispatch = useDispatch()
  const [items, setItems] = useState<OutlineItem[]>([])

  // Parse headings from content using marked lexer
  useEffect(() => {
    const tokens = marked.lexer(content)
    const parsed: OutlineItem[] = []

    // Track position to calculate line numbers
    let currentOffset = 0

    tokens.forEach((token) => {
      if (token.type === 'heading') {
        // Calculate line number from offset in source
        const lineNumber = content.substring(0, currentOffset).split('\n').length

        parsed.push({
          id: `heading-${lineNumber}`,
          level: token.depth,
          text: token.text,
          lineNumber
        })
      }
      // Advance offset by the raw token length
      if ('raw' in token) {
        currentOffset = content.indexOf(token.raw, currentOffset) + token.raw.length
      }
    })

    setItems(parsed)
  }, [content])

  const handleClick = (item: OutlineItem) => {
    if (!editorRef.current) return

    // Scroll editor to line and set cursor
    editorRef.current.revealLineInCenter(item.lineNumber)
    editorRef.current.setPosition({ lineNumber: item.lineNumber, column: 1 })
    editorRef.current.focus()
  }

  const handleClose = () => {
    dispatch(toggleOutline())
  }

  return (
    <div className="outline-sidebar">
      <div className="outline-header">
        <span className="outline-title">Outline</span>
        <button className="outline-close" onClick={handleClose} title="Close outline">
          <svg viewBox="0 0 10 10" width="10" height="10">
            <path d="M1 0L0 1l4 4-4 4 1 1 4-4 4 4 1-1-4-4 4-4-1-1-4 4-4-4z" fill="currentColor" />
          </svg>
        </button>
      </div>
      <div className="outline-content">
        {items.length === 0 ? (
          <div className="outline-empty">No headings found</div>
        ) : (
          items.map(item => (
            <button
              key={item.id}
              className={`outline-item outline-level-${item.level}`}
              onClick={() => handleClick(item)}
              title={`Go to line ${item.lineNumber}`}
            >
              {item.text}
            </button>
          ))
        )}
      </div>
    </div>
  )
}
