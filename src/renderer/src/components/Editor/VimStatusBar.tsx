import { forwardRef } from 'react'
import { useSelector } from 'react-redux'
import { selectVimMode } from '../../store/settingsSlice'
import './VimStatusBar.css'

export const VimStatusBar = forwardRef<HTMLDivElement>(function VimStatusBar(_, ref) {
  const vimEnabled = useSelector(selectVimMode)

  if (!vimEnabled) return null

  return (
    <div className="vim-status-bar" ref={ref} />
  )
})
