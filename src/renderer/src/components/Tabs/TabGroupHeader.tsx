interface TabGroupHeaderProps {
  color: string
}

export function TabGroupHeader({ color }: TabGroupHeaderProps) {
  return (
    <div
      className="tab-group-header"
      style={{ backgroundColor: color }}
    />
  )
}
