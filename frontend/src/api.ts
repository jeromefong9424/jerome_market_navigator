import axios from 'axios'

// In production (GitHub Pages), VITE_API_URL is set to the Hetzner backend URL.
// In dev, falls back to the Vite proxy (/api → localhost:8001).
const BASE = (import.meta.env.VITE_API_URL as string) || '/api'
const API_KEY = (import.meta.env.VITE_JMN_API_KEY as string) || ''

const authHeaders = API_KEY ? { 'X-API-Key': API_KEY } : {}

export const fetchRS = (tickers: string[], refresh = false) =>
  axios.get(`${BASE}/rs`, { params: { tickers: tickers.join(','), ...(refresh ? { refresh: true } : {}) } }).then((r) => r.data)

// Groups — returns { [groupName]: string[] }
export const fetchGroups = (): Promise<Record<string, string[]>> =>
  axios.get(`${BASE}/tickers`).then((r) => r.data)

export const createGroup = (name: string): Promise<Record<string, string[]>> =>
  axios.post(`${BASE}/tickers/groups`, { name }, { headers: authHeaders }).then((r) => r.data)

export const deleteGroup = (name: string): Promise<Record<string, string[]>> =>
  axios.delete(`${BASE}/tickers/groups/${encodeURIComponent(name)}`, { headers: authHeaders }).then((r) => r.data)

export const addTickerToGroup = (group: string, ticker: string): Promise<Record<string, string[]>> =>
  axios.post(`${BASE}/tickers/groups/${encodeURIComponent(group)}/tickers`, { ticker }, { headers: authHeaders }).then((r) => r.data)

export const removeTickerFromGroup = (group: string, ticker: string): Promise<Record<string, string[]>> =>
  axios.delete(`${BASE}/tickers/groups/${encodeURIComponent(group)}/tickers/${ticker}`, { headers: authHeaders }).then((r) => r.data)

export const fetchHoldings = (tickers: string[]): Promise<Record<string, string[]>> =>
  axios.get(`${BASE}/holdings`, { params: { tickers: tickers.join(',') } }).then((r) => r.data)

export const fetchCandles = (ticker: string): Promise<{ time: string; open: number; high: number; low: number; close: number }[]> =>
  axios.get(`${BASE}/rs`, { params: { tickers: ticker } }).then((r) => r.data[0]?.candles ?? [])

export interface CompanyInfo {
  ticker: string
  name: string
  sector: string
  industry: string
  summary: string
}

export const fetchInfo = (ticker: string): Promise<CompanyInfo> =>
  axios.get(`${BASE}/info`, { params: { ticker } }).then((r) => r.data)

// ─── Regime ───────────────────────────────────────────────────────────────────
export interface RegimeData {
  date: string
  spy: {
    close: number; ema8: number; distance_pct: number; above: boolean
    pct_1w: number; pct_1m: number; ytd_pct: number
    '52w_high': number; from_high_pct: number
  }
  qqq: {
    close: number; ema8: number; distance_pct: number; above: boolean
    pct_1w: number; pct_1m: number; ytd_pct: number
    '52w_high': number; from_high_pct: number
  }
  iwm_qqq: { ratio: number; ratio_5d_change: number; risk_on: boolean }
  ibit: { close: number; sma50: number; distance_pct: number; above: boolean }
  regime: 'green' | 'yellow' | 'red'
  label: string
}

export const fetchRegime = (): Promise<RegimeData> =>
  axios.get(`${BASE}/regime`).then((r) => r.data)

// ─── Theme Leaders ─────────────────────────────────────────────────────────────
export interface ThemeLeader {
  ticker: string
  rank: number
  rs_slope: number
  price: number
  above_ema8: boolean
  above_ema21: boolean
  above_ema50: boolean | null
  pct_from_high: number
  pct_1w: number | null
  pct_1m: number | null
  atr_contraction: number
  vol_ratio: number
  ema8: number | null
  ema21: number | null
  ema50: number | null
  high52w: number
  is_gap: boolean
  gap_branch: string
  ohlcv: { time: string; open: number; high: number; low: number; close: number; volume: number }[]
}

export interface ThemeLeadersResponse {
  date: string
  theme_id: string
  theme_name: string
  leaders: ThemeLeader[]
}

export const fetchThemeLeaders = (themeId: string): Promise<ThemeLeadersResponse> =>
  axios.get(`${BASE}/theme/${themeId}/leaders`).then((r) => r.data)

// ─── Theme Map (AI Supply Chain) ────────────────────────────────────────────────
export interface ThemeMapBranch {
  name: string
  status: 'running' | 'setting_up' | 'early' | 'extended' | 'correcting'
  tickers: string[]
  mapped_etf: string | null
  note: string
}

export interface ThemeMapTheme {
  id: string
  demand_driver: string
  catalyst: string
  branches: ThemeMapBranch[]
}

export interface ThemeMapBriefing {
  regime: string
  hottest: string
  gaps: string
  avoid: string
}

export interface ThemeMapResponse {
  date: string
  themes: ThemeMapTheme[]
  briefing: ThemeMapBriefing
}

export const fetchThemeMap = (): Promise<ThemeMapResponse> =>
  axios.get(`${BASE}/theme-map`).then((r) => r.data)
