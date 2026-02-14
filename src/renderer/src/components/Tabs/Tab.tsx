interface TabProps {
  id: string
  filename: string
  isDirty: boolean
  isActive: boolean
  onClick: () => void
  onClose: (e: React.MouseEvent) => void
  title?: string
}

export function Tab({ filename, isDirty, isActive, onClick, onClose, title }: TabProps) {
  return (
    <div
      className={`tab ${isActive ? 'active' : ''}`}
      onClick={onClick}
      title={title || filename}
    >
      <span className="tab-label">
        {filename}
        {isDirty && <span className="dirty-indicator">●</span>}
      </span>
      <button
        className="tab-close"
        onClick={onClose}
        aria-label="Close tab"
      >
        ×
      </button>
    </div>
  )
}
