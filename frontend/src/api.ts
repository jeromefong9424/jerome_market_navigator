import axios from 'axios'

const BASE = '/api'

export const fetchRS = (tickers: string[]) =>
  axios.get(`${BASE}/rs`, { params: { tickers: tickers.join(',') } }).then((r) => r.data)
