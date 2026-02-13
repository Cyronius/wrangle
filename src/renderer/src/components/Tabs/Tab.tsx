interface TabProps {
  id: string
  filename: string
  isDirty: boolean
  isActive: boolean
  workspaceColor?: string // WTB-005: Active tab uses workspace color
  onClick: () => void
  onClose: (e: React.MouseEvent) => void
  title?: string
}

export function Tab({ filename, isDirty, isActive, workspaceColor, onClick, onClose, title }: TabProps) {
  // WTB-005: Active tab underline uses workspace color instead of accent color
  const activeStyle = isActive && workspaceColor
    ? { borderBottomColor: workspaceColor }
    : undefined

  return (
    <div
      className={`tab ${isActive ? 'active' : ''}`}
      onClick={onClick}
      title={title || filename}
      style={activeStyle}
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
