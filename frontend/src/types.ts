export interface MarketData {
  ticker: string
  current: number | null
  day_high: number | null
  day_low: number | null
  prev_high: number | null
  prev_close: number | null
  change: number | null
  change_pct: number | null
}

export interface Sizing {
  shares: number
  risk_per_share: number
  actual_risk: number
  position_value: number
}

export interface WatchlistRow extends MarketData {
  triggered: boolean
  sizing: Sizing | null
  error: string | null
  rvol?: number | null
}
