import { useState, useRef, useMemo } from 'react'
import { ChevronDown } from 'lucide-react'
import themeGroups from '../config/themeGroups.json'
import { useStore } from '../store'

interface RSRow {
  ticker: string
  rs_slope: number
  rs_strength: number
  rs_momentum: number
  price?: number
  pct_1w?: number | null
  pct_1m?: number | null
  ytd_pct?: number | null
  from_high_pct?: number | null
}

const SECTOR_ETFS = new Set(['XLK', 'XLE', 'XLF', 'XLV', 'XLI', 'XLY', 'XLP', 'XLU', 'XLB', 'XLRE'])

function dotColor(rs: number) {
  if (rs > 1.0) return '#2ea043'
  if (rs >= 0) return '#d29922'
  return '#f85149'
}

export default function ThemeSidebar({
  rsData,
  selectedTheme,
  onSelectTheme,
}: {
  rsData: RSRow[]
  selectedTheme: string | null
  onSelectTheme: (id: string) => void
}) {
  const setSelectedTicker = useStore(s => s.setSelectedTicker)
  const [collapsed, setCollapsed] = useState(false)
  const [sidebarTab, setSidebarTab] = useState<'themes' | 'sectors'>('themes')
  const [filterTheme, setFilterTheme] = useState<string>('all')
  const [sortCol, setSortCol] = useState<'rs_slope' | 'pct_1w' | 'pct_1m' | 'ytd_pct'>('pct_1w')
  const [sortDir, setSortDir] = useState<1 | -1>(-1)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Build flat list of all ETFs with their theme info
  const allETFs = useMemo(() => {
    const rsMap = new Map(rsData.map(r => [r.ticker, r]))
    const rows: (RSRow & { themeId: string; themeName: string })[] = []
    for (const theme of themeGroups.themes) {
      for (const ticker of theme.etfs) {
        const rs = rsMap.get(ticker)
        if (rs) {
          rows.push({ ...rs, themeId: theme.id, themeName: theme.name })
        }
      }
    }
    return rows
  }, [rsData])

  // Sector ETFs flat list
  const sectorETFs = useMemo(() => {
    return rsData
      .filter(r => SECTOR_ETFS.has(r.ticker))
      .map(r => ({ ...r, themeId: 'sectors', themeName: 'Sector' }))
  }, [rsData])

  // Pick list based on tab
  const tabData = sidebarTab === 'sectors'
    ? sectorETFs
    : allETFs.filter(r => !SECTOR_ETFS.has(r.ticker))

  // Filter (theme dropdown only applies to themes tab)
  const filtered = sidebarTab === 'themes' && filterTheme !== 'all'
    ? tabData.filter(r => r.themeId === filterTheme)
    : tabData

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    let av: number, bv: number
    switch (sortCol) {
      case 'pct_1w': av = a.pct_1w ?? -999; bv = b.pct_1w ?? -999; break
      case 'pct_1m': av = a.pct_1m ?? -999; bv = b.pct_1m ?? -999; break
      case 'ytd_pct': av = a.ytd_pct ?? -999; bv = b.ytd_pct ?? -999; break
      default: av = a.rs_slope; bv = b.rs_slope
    }
    return (av > bv ? 1 : av < bv ? -1 : 0) * sortDir
  })

  const handleSort = (col: typeof sortCol) => {
    if (sortCol === col) setSortDir(d => d === 1 ? -1 : 1)
    else { setSortCol(col); setSortDir(1) }
  }

  const selectETF = (ticker: string, themeId: string) => {
    setSelectedTicker(ticker)
    onSelectTheme(themeId)
  }

  const selectedThemeName = useMemo(() => {
    if (filterTheme === 'all') return 'All Themes'
    return themeGroups.themes.find(t => t.id === filterTheme)?.name ?? filterTheme
  }, [filterTheme])

  if (collapsed) {
    return (
      <div className="flex-shrink-0 border-r border-white/5 w-10 bg-[#0d1117] flex flex-col items-center py-3 gap-2">
        <button onClick={() => setCollapsed(false)} className="text-zinc-600 hover:text-zinc-300 text-xs px-1 py-4">
          <span style={{ writingMode: 'vertical-rl' }}>▶ All ETFs</span>
        </button>
      </div>
    )
  }

  return (
    <div className="flex-shrink-0 border-r border-white/5 w-[320px] bg-[#0d1117] flex flex-col overflow-hidden">
      {/* Header with tab toggle */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 flex-shrink-0">
        <div className="flex items-center rounded-md border border-white/10 overflow-hidden">
          <button
            onClick={() => setSidebarTab('themes')}
            className={`px-2.5 py-1 text-[9px] font-semibold transition-colors ${
              sidebarTab === 'themes' ? 'bg-[#1c2129] text-zinc-200' : 'text-zinc-600 hover:text-zinc-400'
            }`}
          >
            Theme ETFs
          </button>
          <button
            onClick={() => setSidebarTab('sectors')}
            className={`px-2.5 py-1 text-[9px] font-semibold transition-colors ${
              sidebarTab === 'sectors' ? 'bg-[#1c2129] text-zinc-200' : 'text-zinc-600 hover:text-zinc-400'
            }`}
          >
            Sector ETFs
          </button>
        </div>
        <button onClick={() => setCollapsed(true)} className="text-zinc-700 hover:text-zinc-400 transition-colors text-[10px]">
          ◀
        </button>
      </div>

      {/* Theme filter + sort */}
      <div className="px-3 py-1.5 border-b border-white/5 flex-shrink-0 space-y-1">
        {/* Theme dropdown (themes tab only) */}
        {sidebarTab === 'themes' && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(o => !o)}
              className="w-full flex items-center justify-between px-2 py-1 bg-[#161b22] border border-white/10 rounded text-[10px] text-zinc-300 hover:bg-[#1c2129] transition-colors"
            >
              <span className="truncate">{selectedThemeName}</span>
              <ChevronDown size={10} className={`text-zinc-500 flex-shrink-0 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {dropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-[#1c2129] border border-white/10 rounded z-50 shadow-xl max-h-48 overflow-y-auto">
                <button
                  onClick={() => { setFilterTheme('all'); setDropdownOpen(false) }}
                  className={`w-full text-left px-2 py-1 text-[10px] transition-colors ${filterTheme === 'all' ? 'text-[#58a6ff] bg-[#1c3a5f]' : 'text-zinc-300 hover:bg-[#161b22]'}`}
                >
                  All Themes
                </button>
                {themeGroups.themes.map(t => (
                  <button
                    key={t.id}
                    onClick={() => { setFilterTheme(t.id); setDropdownOpen(false) }}
                    className={`w-full text-left px-2 py-1 text-[10px] transition-colors truncate ${filterTheme === t.id ? 'text-[#58a6ff] bg-[#1c3a5f]' : 'text-zinc-300 hover:bg-[#161b22]'}`}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Sort buttons */}
        <div className="flex gap-0.5">
          {(['rs_slope', 'pct_1w', 'pct_1m', 'ytd_pct'] as const).map(col => (
            <button
              key={col}
              onClick={() => handleSort(col)}
              className={`flex-1 text-[8px] py-0.5 rounded transition-colors ${
                sortCol === col ? 'bg-[#1c3a5f] text-[#58a6ff]' : 'text-zinc-600 hover:text-zinc-400'
              }`}
            >
              {col === 'rs_slope' ? 'RS' : col === 'pct_1w' ? '1W' : col === 'pct_1m' ? '1M' : 'YTD'}
              {sortCol === col && (sortDir === 1 ? ' ↑' : ' ↓')}
            </button>
          ))}
        </div>
      </div>

      {/* ETF rows */}
      <div className="flex-1 overflow-y-auto">
        {sorted.map((row, i) => {
          const isSelected = selectedTheme === row.themeId
          return (
            <button
              key={row.ticker}
              onClick={() => selectETF(row.ticker, row.themeId)}
              className={`w-full grid items-center gap-1 px-3 py-2 border-b border-white/[0.03] text-left transition-all ${
                isSelected ? 'bg-[#1c2129] border-l-2 border-l-[#58a6ff]' : 'hover:bg-[#161b22] border-l-2 border-l-transparent'
              }`}
              style={{ gridTemplateColumns: '16px 14px 1fr 64px 56px' }}
            >
              {/* Rank */}
              <span className="text-[9px] text-zinc-600 font-mono">
                {i + 1}
              </span>

              {/* Status dot */}
              <span
                className="w-1.5 h-1.5 rounded-full justify-self-center"
                style={{ background: dotColor(row.rs_slope) }}
              />

              {/* Ticker */}
              <span className="text-[11px] font-bold text-zinc-200 truncate">{row.ticker}</span>

              {/* Theme */}
              <span className="text-[8px] text-zinc-500 truncate pr-1" title={row.themeName}>
                {row.themeName}
              </span>

              {/* Performance % — matches active sort column */}
              {(() => {
                const val = sortCol === 'pct_1m' ? row.pct_1m
                  : sortCol === 'ytd_pct' ? row.ytd_pct
                  : row.pct_1w
                return (
                  <span
                    className="text-[10px] font-mono font-semibold tabular-nums text-right"
                    style={{ color: (val ?? 0) >= 0 ? '#2ea043' : '#f85149' }}
                  >
                    {val != null ? `${val >= 0 ? '+' : ''}${val.toFixed(1)}%` : '—'}
                  </span>
                )
              })()}
            </button>
          )
        })}

        {sorted.length === 0 && (
          <div className="px-3 py-6 text-[10px] text-zinc-600 text-center">
            No ETFs found
          </div>
        )}
      </div>
    </div>
  )
}
