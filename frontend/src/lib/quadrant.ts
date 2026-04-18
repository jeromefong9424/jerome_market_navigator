export type Quadrant = 'leading' | 'improving' | 'weakening' | 'lagging'

export function quadrant(rs_strength: number, rs_momentum: number): Quadrant {
  const strong = rs_strength >= 100
  const positive = rs_momentum >= 0
  if (strong && positive) return 'leading'
  if (strong && !positive) return 'weakening'
  if (!strong && positive) return 'improving'
  return 'lagging'
}

export const QUAD_COLOR: Record<Quadrant, string> = {
  leading:   '#9b8cff',
  improving: '#6cb0ff',
  weakening: '#f2b366',
  lagging:   '#ef6f8d',
}

export const QUAD_LABEL: Record<Quadrant, string> = {
  leading:   'LEADING',
  improving: 'IMPROVING',
  weakening: 'WEAKENING',
  lagging:   'LAGGING',
}

export const QUAD_BG: Record<Quadrant, string> = {
  leading:   'rgba(155,140,255,0.15)',
  improving: 'rgba(108,176,255,0.15)',
  weakening: 'rgba(242,179,102,0.15)',
  lagging:   'rgba(239,111,141,0.15)',
}
