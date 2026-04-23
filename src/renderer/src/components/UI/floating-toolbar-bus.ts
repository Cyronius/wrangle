type Listener = () => void

const listeners = new Set<Listener>()

export const floatingToolbarBus = {
  openAtCursor(): void {
    console.log('[tap-alt] bus.openAtCursor listeners=', listeners.size)
    listeners.forEach((l) => l())
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener)
    console.log('[tap-alt] bus.subscribe size=', listeners.size)
    return () => {
      listeners.delete(listener)
      console.log('[tap-alt] bus.unsubscribe size=', listeners.size)
    }
  }
}
