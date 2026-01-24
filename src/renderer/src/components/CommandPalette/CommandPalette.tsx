import { useState, useEffect, useRef, useMemo } from 'react'
import { useSelector } from 'react-redux'
import { commands, CommandDefinition, categoryLabels } from '../../commands/registry'
import { selectCurrentBindings } from '../../store/settingsSlice'
import { RootState } from '../../store/store'
import './command-palette.css'

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  onExecute: (command: CommandDefinition) => void
}

export function CommandPalette({ isOpen, onClose, onExecute }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const bindings = useSelector((state: RootState) => selectCurrentBindings(state))

  // Filter commands based on query
  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands
    const lowerQuery = query.toLowerCase()
    return commands.filter(cmd =>
      cmd.label.toLowerCase().includes(lowerQuery) ||
      cmd.category.toLowerCase().includes(lowerQuery) ||
      cmd.id.toLowerCase().includes(lowerQuery) ||
      (cmd.bindingDisplay?.toLowerCase().includes(lowerQuery) ?? false)
    )
  }, [query])

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [isOpen])

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return
    const items = listRef.current.querySelectorAll('.command-palette-item')
    const selectedItem = items[selectedIndex] as HTMLElement
    if (selectedItem) {
      selectedItem.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(i => Math.min(i + 1, filteredCommands.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(i => Math.max(i - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (filteredCommands[selectedIndex] && !filteredCommands[selectedIndex].readOnly) {
          onExecute(filteredCommands[selectedIndex])
          onClose()
        }
        break
      case 'Escape':
        e.preventDefault()
        onClose()
        break
    }
  }

  if (!isOpen) return null

  return (
    <div className="command-palette-overlay" onClick={onClose}>
      <div className="command-palette" onClick={e => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <input
          ref={inputRef}
          className="command-palette-input"
          type="text"
          placeholder="Type a command..."
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <div className="command-palette-list" ref={listRef}>
          {filteredCommands.length === 0 ? (
            <div className="command-palette-empty">No matching commands</div>
          ) : (
            filteredCommands.map((cmd, index) => {
              const shortcut = cmd.bindingDisplay || bindings[cmd.id] || cmd.defaultBinding
              return (
                <div
                  key={cmd.id}
                  className={`command-palette-item ${index === selectedIndex ? 'selected' : ''} ${cmd.readOnly ? 'readonly' : ''}`}
                  onClick={() => {
                    if (!cmd.readOnly) {
                      onExecute(cmd)
                      onClose()
                    }
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <span className="command-palette-item-category">
                    {categoryLabels[cmd.category]}
                  </span>
                  <span className="command-palette-item-label">{cmd.label}</span>
                  {shortcut && (
                    <span className={`command-palette-item-shortcut ${cmd.readOnly ? 'readonly' : ''}`}>{shortcut}</span>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
