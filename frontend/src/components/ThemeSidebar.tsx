import { useState, useRef, useMemo, useCallback } from 'react'
import { ChevronDown } from 'lucide-react'
import themeGroups from '../config/themeGroups.json'
import { useStore } from '../store'
import { quadrant, QUAD_COLOR } from '../lib/quadrant'

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

const SECTOR_ETFS = new Set(['XLK', 'XLE', 'XLF', 'XLV', 'XLI', 'XLY', 'XLP', 'XLU', 'XLB', 'XLRE', 'XLC'])

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
  const [sidebarWidth, setSidebarWidth] = useState(280)
  const resizing = useRef(false)
  const [filterTheme, setFilterTheme] = useState<string>('all')
  const [sortCol, setSortCol] = useState<'rs_slope' | 'pct_1w' | 'pct_1m' | 'ytd_pct'>('pct_1w')
  const [sortDir, setSortDir] = useState<1 | -1>(-1)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const allETFs = useMemo(() => {
    const rsMap = new Map(rsData.map(r => [r.ticker, r]))
    const rows: (RSRow & { themeId: string; themeName: string })[] = []
    for (const theme of themeGroups.themes) {
      for (const ticker of theme.etfs) {
        const rs = rsMap.get(ticker)
        if (rs) rows.push({ ...rs, themeId: theme.id, themeName: theme.name })
      }
    }
    return rows
  }, [rsData])

  const sectorETFs = useMemo(() => {
    return rsData
      .filter(r => SECTOR_ETFS.has(r.ticker))
      .map(r => ({ ...r, themeId: 'sectors', themeName: 'Sector' }))
  }, [rsData])

  const tabData = sidebarTab === 'sectors'
    ? sectorETFs
    : allETFs.filter(r => !SECTOR_ETFS.has(r.ticker))

  const filtered = sidebarTab === 'themes' && filterTheme !== 'all'
    ? tabData.filter(r => r.themeId === filterTheme)
    : tabData

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
    else { setSortCol(col); setSortDir(-1) }
  }

  const selectETF = (ticker: string, themeId: string) => {
    setSelectedTicker(ticker)
    onSelectTheme(themeId)
  }

  const onResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    resizing.current = true
    const startX = e.clientX
    const startW = sidebarWidth
    const onMove = (ev: MouseEvent) => {
      if (!resizing.current) return
      const newW = Math.max(240, Math.min(600, startW + (ev.clientX - startX)))
      setSidebarWidth(newW)
    }
    const onUp = () => {
      resizing.current = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [sidebarWidth])

  const selectedThemeName = useMemo(() => {
    if (filterTheme === 'all') return 'All Themes'
    return themeGroups.themes.find(t => t.id === filterTheme)?.name ?? filterTheme
  }, [filterTheme])

  if (collapsed) {
    return (
      <div
        className="flex-shrink-0 w-10 flex flex-col items-center py-3 gap-2 border-r"
        style={{ borderColor: 'var(--line)', background: 'var(--bg)' }}
      >
        <button
          onClick={() => setCollapsed(false)}
          className="text-xs px-1 py-4 transition-colors"
          style={{ color: 'var(--muted-2)' }}
        >
          <span style={{ writingMode: 'vertical-rl' }}>▶ All ETFs</span>
        </button>
      </div>
    )
  }

  const sortOpts = [
    { id: 'rs_slope', label: 'RS' },
    { id: 'pct_1w', label: '1W' },
    { id: 'pct_1m', label: '1M' },
    { id: 'ytd_pct', label: 'YTD' },
  ] as const

  return (
    <div
      className="flex-shrink-0 flex flex-col overflow-hidden relative border-r max-md:hidden"
      style={{ width: sidebarWidth, borderColor: 'var(--line)', background: 'transparent' }}
    >
      {/* Header + tab toggle */}
      <div
        className="flex items-center justify-between px-3 py-2.5 border-b flex-shrink-0"
        style={{ borderColor: 'var(--line)' }}
      >
        <div
          className="flex items-center rounded-[10px] p-[3px] border"
          style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}
        >
          <button
            onClick={() => setSidebarTab('themes')}
            className="px-2.5 h-6 rounded-[7px] text-[10px] font-semibold transition-colors"
            style={{
              background: sidebarTab === 'themes' ? 'var(--panel-hi)' : 'transparent',
              color: sidebarTab === 'themes' ? 'var(--text)' : 'var(--muted)',
            }}
          >
            Theme
          </button>
          <button
            onClick={() => setSidebarTab('sectors')}
            className="px-2.5 h-6 rounded-[7px] text-[10px] font-semibold transition-colors"
            style={{
              background: sidebarTab === 'sectors' ? 'var(--panel-hi)' : 'transparent',
              color: sidebarTab === 'sectors' ? 'var(--text)' : 'var(--muted)',
            }}
          >
            Sector
          </button>
        </div>
        <button
          onClick={() => setCollapsed(true)}
          className="text-[10px] transition-colors"
          style={{ color: 'var(--muted-2)' }}
        >
          ◀
        </button>
      </div>

      {/* Filter + sort */}
      <div
        className="px-3 py-2 border-b flex-shrink-0 space-y-1.5"
        style={{ borderColor: 'var(--line)' }}
      >
        {sidebarTab === 'themes' && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(o => !o)}
              className="w-full flex items-center justify-between px-2.5 h-7 rounded-[8px] border text-[11px] transition-colors"
              style={{
                background: 'var(--panel)',
                borderColor: 'var(--line)',
                color: 'var(--text)',
              }}
            >
              <span className="truncate">{selectedThemeName}</span>
              <ChevronDown size={11} className={`flex-shrink-0 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} style={{ color: 'var(--muted-2)' }} />
            </button>
            {dropdownOpen && (
              <div
                className="absolute top-full left-0 right-0 mt-1 rounded-[8px] z-50 shadow-xl max-h-48 overflow-y-auto border"
                style={{ background: '#12182a', borderColor: 'var(--line-2)' }}
              >
                <button
                  onClick={() => { setFilterTheme('all'); setDropdownOpen(false) }}
                  className="w-full text-left px-2.5 h-7 text-[11px] transition-colors"
                  style={{
                    color: filterTheme === 'all' ? 'var(--leading)' : 'var(--text)',
                    background: filterTheme === 'all' ? 'rgba(155,140,255,0.08)' : 'transparent',
                  }}
                >
                  All Themes
                </button>
                {themeGroups.themes.map(t => (
                  <button
                    key={t.id}
                    onClick={() => { setFilterTheme(t.id); setDropdownOpen(false) }}
                    className="w-full text-left px-2.5 h-7 text-[11px] transition-colors truncate"
                    style={{
                      color: filterTheme === t.id ? 'var(--leading)' : 'var(--text)',
                      background: filterTheme === t.id ? 'rgba(155,140,255,0.08)' : 'transparent',
                    }}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Segmented sort control */}
        <div
          className="flex rounded-[10px] p-[3px] border"
          style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}
        >
          {sortOpts.map(opt => (
            <button
              key={opt.id}
              onClick={() => handleSort(opt.id)}
              className="flex-1 h-6 rounded-[7px] text-[10px] font-mono font-semibold transition-colors"
              style={{
                background: sortCol === opt.id ? 'var(--panel-hi)' : 'transparent',
                color: sortCol === opt.id ? 'var(--text)' : 'var(--muted)',
              }}
            >
              {opt.label}
              {sortCol === opt.id && <span className="ml-0.5" style={{ color: 'var(--muted-2)' }}>{sortDir === 1 ? '↑' : '↓'}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto px-2 py-1.5">
        {sorted.map((row, i) => {
          const isSelected = selectedTheme === row.themeId
          const quad = quadrant(row.rs_strength, row.rs_momentum)
          const quadColor = QUAD_COLOR[quad]
          const val = sortCol === 'pct_1m' ? row.pct_1m
            : sortCol === 'ytd_pct' ? row.ytd_pct
            : sortCol === 'rs_slope' ? row.rs_slope
            : row.pct_1w
          const valStr = sortCol === 'rs_slope'
            ? (val != null ? (val >= 0 ? `+${val.toFixed(2)}` : val.toFixed(2)) : '—')
            : (val != null ? (val >= 0 ? `+${val.toFixed(1)}%` : `${val.toFixed(1)}%`) : '—')
          return (
            <button
              key={row.ticker}
              onClick={() => selectETF(row.ticker, row.themeId)}
              className="w-full grid items-center gap-2.5 px-2.5 py-2.5 mb-0.5 rounded-lg text-left transition-colors border-l-2"
              style={{
                background: isSelected ? 'rgba(155,140,255,0.08)' : 'transparent',
                borderLeftColor: isSelected ? 'var(--leading)' : 'transparent',
                gridTemplateColumns: '18px 1fr auto',
              }}
              onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--panel)' }}
              onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
            >
              <span className="font-mono text-[10px] tabular-nums" style={{ color: 'var(--muted-2)' }}>
                {i + 1}
              </span>
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: quadColor }}
                />
                <span className="text-[12px] font-semibold truncate" style={{ color: 'var(--text)' }}>
                  {row.ticker}
                </span>
                <span className="text-[10px] truncate" style={{ color: 'var(--muted-2)' }}>
                  {row.themeName}
                </span>
              </div>
              <span
                className="font-mono text-[11px] font-semibold tabular-nums"
                style={{ color: (val ?? 0) >= 0 ? 'var(--up)' : 'var(--down)' }}
              >
                {valStr}
              </span>
            </button>
          )
        })}

        {sorted.length === 0 && (
          <div className="px-3 py-6 text-[11px] text-center" style={{ color: 'var(--muted-2)' }}>
            No ETFs found
          </div>
        )}
      </div>

      <div
        onMouseDown={onResizeStart}
        className="absolute top-0 right-0 w-1 h-full cursor-col-resize transition-colors z-10 hover:bg-[rgba(155,140,255,0.4)]"
      />
    </div>
  )
}
