import { useEffect, useRef, RefObject } from 'react'

const EDGE_SIZE = 20 // pixels from edge to trigger scrolling
const MAX_SPEED = 8 // max pixels per frame

/**
 * Auto-scrolls a container when the mouse is near its top or bottom edge.
 * Works for both regular mouse hover and drag operations.
 */
export function useEdgeScroll(containerRef: RefObject<HTMLElement | null>) {
  const animationRef = useRef<number | null>(null)
  const scrollSpeedRef = useRef(0)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    function getScrollSpeed(clientY: number): number {
      const rect = container!.getBoundingClientRect()
      const topDist = clientY - rect.top
      const bottomDist = rect.bottom - clientY

      if (topDist < EDGE_SIZE && container!.scrollTop > 0) {
        // Scroll up - speed proportional to proximity
        return -MAX_SPEED * (1 - topDist / EDGE_SIZE)
      } else if (bottomDist < EDGE_SIZE && container!.scrollTop < container!.scrollHeight - container!.clientHeight) {
        // Scroll down - speed proportional to proximity
        return MAX_SPEED * (1 - bottomDist / EDGE_SIZE)
      }
      return 0
    }

    function startAnimation() {
      if (!animationRef.current) {
        animationRef.current = requestAnimationFrame(animate)
      }
    }

    function stopAnimation() {
      scrollSpeedRef.current = 0
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
    }

    function animate() {
      if (scrollSpeedRef.current !== 0 && container) {
        container.scrollTop += scrollSpeedRef.current
      }
      animationRef.current = requestAnimationFrame(animate)
    }

    // Mouse hover handlers
    function handleMouseMove(e: MouseEvent) {
      scrollSpeedRef.current = getScrollSpeed(e.clientY)
      startAnimation()
    }

    function handleMouseLeave() {
      stopAnimation()
    }

    // Drag handlers
    function handleDragOver(e: DragEvent) {
      scrollSpeedRef.current = getScrollSpeed(e.clientY)
    }

    function handleDragStart() {
      startAnimation()
    }

    function handleDragEnd() {
      stopAnimation()
    }

    container.addEventListener('mousemove', handleMouseMove)
    container.addEventListener('mouseleave', handleMouseLeave)
    container.addEventListener('dragover', handleDragOver)
    container.addEventListener('dragleave', handleMouseLeave)
    container.addEventListener('dragenter', handleDragStart)
    container.addEventListener('drop', handleDragEnd)

    return () => {
      container.removeEventListener('mousemove', handleMouseMove)
      container.removeEventListener('mouseleave', handleMouseLeave)
      container.removeEventListener('dragover', handleDragOver)
      container.removeEventListener('dragleave', handleMouseLeave)
      container.removeEventListener('dragenter', handleDragStart)
      container.removeEventListener('drop', handleDragEnd)
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [containerRef])
}
