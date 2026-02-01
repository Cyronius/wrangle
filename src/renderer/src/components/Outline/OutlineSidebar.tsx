import { useState, useEffect, useRef, memo } from 'react'
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

export const OutlineSidebar = memo(function OutlineSidebar({ content, editorRef }: OutlineSidebarProps) {
  const dispatch = useDispatch()
  const [items, setItems] = useState<OutlineItem[]>([])
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Parse headings from content using marked lexer (debounced)
  useEffect(() => {
    // Clear existing timeout
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    // Debounce parsing by 1000ms to reduce work during typing
    debounceRef.current = setTimeout(() => {
      const tokens = marked.lexer(content)
      const parsed: OutlineItem[] = []

      // Track position and line number incrementally (O(n) total instead of O(n*m))
      let currentOffset = 0
      let currentLine = 1

      tokens.forEach((token) => {
        if ('raw' in token) {
          // Find where this token starts
          const tokenStart = content.indexOf(token.raw, currentOffset)

          // Count newlines between currentOffset and tokenStart
          for (let i = currentOffset; i < tokenStart; i++) {
            if (content[i] === '\n') currentLine++
          }

          if (token.type === 'heading') {
            parsed.push({
              id: `heading-${currentLine}`,
              level: token.depth,
              text: token.text,
              lineNumber: currentLine
            })
          }

          // Count newlines within the token and advance offset
          for (let i = tokenStart; i < tokenStart + token.raw.length; i++) {
            if (content[i] === '\n') currentLine++
          }
          currentOffset = tokenStart + token.raw.length
        }
      })

      setItems(parsed)
    }, 1000)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
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
})
