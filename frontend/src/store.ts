import { create } from 'zustand'
import type { WatchlistRow } from './types'

interface AppState {
  watchlist: WatchlistRow[]
  setWatchlist: (w: WatchlistRow[]) => void
  selectedTicker: string | null
  setSelectedTicker: (t: string | null) => void
}

export const useStore = create<AppState>()((set) => ({
  watchlist: [],
  setWatchlist: (w) => set({ watchlist: w }),
  selectedTicker: null,
  setSelectedTicker: (t) => set({ selectedTicker: t }),
}))
