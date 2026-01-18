import React from 'react'

interface TextWrapperProps {
  children: React.ReactNode
}

/**
 * Wrapper component that makes text content cursor-able in the preview.
 * Uses contentEditable to enable native browser cursor/selection.
 * All modification events are prevented to keep the preview read-only.
 */
export function TextWrapper({ children }: TextWrapperProps) {
  return (
    <span
      contentEditable
      suppressContentEditableWarning
      onBeforeInput={(e) => e.preventDefault()}
      onInput={(e) => {
        // Extra protection: revert any changes that slip through
        e.preventDefault()
      }}
      onPaste={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
      onDrop={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        // Block Backspace and Delete explicitly
        if (e.key === 'Backspace' || e.key === 'Delete') {
          e.preventDefault()
          return
        }
        // Allow navigation keys
        const allowedKeys = [
          'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
          'Home', 'End', 'PageUp', 'PageDown',
          'Shift', 'Control', 'Alt', 'Meta',
          'Tab', 'Escape', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'
        ]
        // Block all other keys except navigation and modifiers
        if (!allowedKeys.includes(e.key) && !e.ctrlKey && !e.metaKey) {
          // Allow Ctrl+C/A for copy/select all
          e.preventDefault()
          return
        }
      }}
      onKeyPress={(e) => {
        // Block all character input via keypress as well
        e.preventDefault()
      }}
      style={{
        outline: 'none',
        caretColor: 'var(--preview-cursor-color, #4daafc)',
        cursor: 'text'
      }}
    >
      {children}
    </span>
  )
}
