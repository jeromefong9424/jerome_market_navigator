import axios from 'axios'

// In production (GitHub Pages), VITE_API_URL is set to the Render backend URL.
// In dev, falls back to the Vite proxy (/api → localhost:8001).
const BASE = (import.meta.env.VITE_API_URL as string) || '/api'

export const fetchRS = (tickers: string[]) =>
  axios.get(`${BASE}/rs`, { params: { tickers: tickers.join(',') } }).then((r) => r.data)

// Groups — returns { [groupName]: string[] }
export const fetchGroups = (): Promise<Record<string, string[]>> =>
  axios.get(`${BASE}/tickers`).then((r) => r.data)

export const createGroup = (name: string): Promise<Record<string, string[]>> =>
  axios.post(`${BASE}/tickers/groups`, { name }).then((r) => r.data)

export const deleteGroup = (name: string): Promise<Record<string, string[]>> =>
  axios.delete(`${BASE}/tickers/groups/${encodeURIComponent(name)}`).then((r) => r.data)

export const addTickerToGroup = (group: string, ticker: string): Promise<Record<string, string[]>> =>
  axios.post(`${BASE}/tickers/groups/${encodeURIComponent(group)}/tickers`, { ticker }).then((r) => r.data)

export const removeTickerFromGroup = (group: string, ticker: string): Promise<Record<string, string[]>> =>
  axios.delete(`${BASE}/tickers/groups/${encodeURIComponent(group)}/tickers/${ticker}`).then((r) => r.data)

export const fetchHoldings = (tickers: string[]): Promise<Record<string, string[]>> =>
  axios.get(`${BASE}/holdings`, { params: { tickers: tickers.join(',') } }).then((r) => r.data)
