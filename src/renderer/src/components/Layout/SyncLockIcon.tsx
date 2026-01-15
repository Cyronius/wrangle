import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '../../store/store'
import { togglePreviewSync } from '../../store/layoutSlice'
import './SyncLockIcon.css'

interface SyncLockIconProps {
  splitRatio: number
}

export function SyncLockIcon({ splitRatio }: SyncLockIconProps) {
  const dispatch = useDispatch()
  const previewSync = useSelector((state: RootState) => state.layout.previewSync)

  const handleClick = () => {
    dispatch(togglePreviewSync())
  }

  // Position the icon at the split ratio position
  const iconStyle: React.CSSProperties = {
    left: `${splitRatio * 100}%`
  }

  return (
    <button
      className={`sync-lock-icon ${previewSync ? 'synced' : 'unsynced'}`}
      onClick={handleClick}
      title={previewSync ? 'Preview scroll is synced - click to unlock' : 'Preview scroll is unlocked - click to sync'}
      style={iconStyle}
    >
      {previewSync ? (
        // Locked/synced icon - chain links connected
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      ) : (
        // Unlocked/unsynced icon - broken chain links
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 7h2a5 5 0 0 1 0 10h-2" />
          <path d="M9 17H7a5 5 0 0 1 0-10h2" />
        </svg>
      )}
    </button>
  )
}
