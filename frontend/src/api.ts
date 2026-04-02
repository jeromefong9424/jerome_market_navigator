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
