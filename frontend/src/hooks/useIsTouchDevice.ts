import { useState, useEffect } from 'react'

export function useIsTouchDevice(): boolean {
  const [isTouch, setIsTouch] = useState(() =>
    'ontouchstart' in window || navigator.maxTouchPoints > 0
  )
  useEffect(() => {
    const mql = window.matchMedia('(pointer: coarse)')
    const handler = (e: MediaQueryListEvent) => setIsTouch(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])
  return isTouch
}
