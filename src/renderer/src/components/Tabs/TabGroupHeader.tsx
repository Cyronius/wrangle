interface TabGroupHeaderProps {
  color: string
  isCollapsed: boolean
  onToggleCollapse: () => void
}

// Chevron icon pointing right (for collapsed state)
function ChevronRightIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

// Chevron icon pointing left (for expanded state)
function ChevronLeftIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}

export function TabGroupHeader({
  color,
  isCollapsed,
  onToggleCollapse
}: TabGroupHeaderProps) {
  return (
    <div
      className="tab-group-header"
      onClick={onToggleCollapse}
      style={{ backgroundColor: color }}
    >
      {isCollapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
    </div>
  )
}
