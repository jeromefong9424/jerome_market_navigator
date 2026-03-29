import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, Plus, Trash2, TrendingUp, TrendingDown } from 'lucide-react'
import { fetchRS, fetchGroups, createGroup, deleteGroup, addTickerToGroup, removeTickerFromGroup } from '../api'
import { useStore } from '../store'

const TICKER_NAMES: Record<string, string> = {
  XLI:  'Industrials', XLK:  'Technology',    XLU:  'Utilities',
  XLRE: 'Real Estate', XLY:  'Consumer Disc.', XLV:  'Health Care',
  XLB:  'Materials',   SMH:  'Semiconductors', XLE:  'Energy',
  XLF:  'Financials',  XLP:  'Consumer Stap.', XLC:  'Comm. Services',
  SPY:  'S&P 500',     QQQ:  'Nasdaq 100',     IWM:  'Russell 2000',
  DIA:  'Dow Jones',   GLD:  'Gold',            TLT:  'Long Bonds',
  NVDA: 'NVIDIA',      AMD:  'AMD',             AAPL: 'Apple',
  MSFT: 'Microsoft',   GOOGL:'Alphabet',        META: 'Meta',
  AMZN: 'Amazon',      TSLA: 'Tesla',           JPM:  'JPMorgan',
  BAC:  'Bank of America', GS: 'Goldman Sachs', XOM:  'ExxonMobil',
  CVX:  'Chevron',     UNH:  'UnitedHealth',    JNJ:  'Johnson & Johnson',
}

// Sector ETF mapping for watchlist RS
const SECTOR_MAP: Record<string, string> = {
  NVDA: 'SMH', AMD: 'SMH', TSM: 'SMH', INTC: 'SMH',
  AAPL: 'XLK', MSFT: 'XLK', GOOGL: 'XLK', META: 'XLK',
  JPM: 'XLF', BAC: 'XLF', GS: 'XLF',
  XOM: 'XLE', CVX: 'XLE',
  UNH: 'XLV', JNJ: 'XLV',
  AMZN: 'XLY', TSLA: 'XLY',
}

interface RSRow {
  ticker:      string
  rank:        number
  price:       number
  rs_slope:    number
  slope_5d:    number
  rs_norm:     number[]
  rs_strength: number
  rs_momentum: number
  tail:        { rs_strength: number; rs_momentum: number }[]
}

// Mini histogram sparkline — 25 vertical bars
function RSHistogram({ values, slope5d }: { values: number[]; slope5d: number }) {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const color = slope5d > 0 ? '#4ADE80' : '#F87171'

  return (
    <svg width={75} height={22} className="overflow-visible">
      {values.map((v, i) => {
        const h = Math.max(2, ((v - min) / range) * 18)
        return (
          <rect
            key={i}
            x={i * 3}
            y={20 - h}
            width={2}
            height={h}
            fill={color}
            opacity={0.7 + (i / values.length) * 0.3}
          />
        )
      })}
    </svg>
  )
}

// RRG Scatter Plot — interactive, full-width
function RRGChart({ data, onSelect }: { data: RSRow[]; onSelect: (ticker: string) => void }) {
  const [hovered, setHovered] = useState<string | null>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number } | null>(null)

  const W = 420, H = 340, pad = 48

  // Dynamic range: center on median, scale to fit all dots
  const allX = data.map(d => d.rs_strength)
  const allY = data.map(d => d.rs_momentum)
  const cx = 100  // RS strength center (100 = neutral)
  const cy = 0    // Momentum center

  const xRange = Math.max(8, ...allX.map(v => Math.abs(v - cx))) * 1.3
  const yRange = Math.max(4, ...allY.map(v => Math.abs(v - cy))) * 1.3

  const toX = (v: number) => pad + ((v - (cx - xRange)) / (xRange * 2)) * (W - pad * 2)
  const toY = (v: number) => H - pad - ((v - (cy - yRange)) / (yRange * 2)) * (H - pad * 2)

  const axisX = toX(cx)
  const axisY = toY(cy)

  const dotColor = (row: RSRow) =>
    row.rs_strength >= cx && row.rs_momentum >= cy ? '#4ADE80'
    : row.rs_strength >= cx                        ? '#60A5FA'
    : row.rs_momentum >= cy                        ? '#FACC15'
    : '#F87171'

  const hoveredRow = data.find(d => d.ticker === hovered)

  return (
    <div className="relative w-full">
      <svg
        width="100%"
        viewBox={`0 0 ${W} ${H}`}
        className="overflow-visible"
        onMouseLeave={() => { setHovered(null); setTooltip(null) }}
      >
        {/* Quadrant backgrounds */}
        <rect x={axisX} y={pad}    width={W - pad - axisX} height={axisY - pad}  fill="#4ADE80" opacity={0.06} />
        <rect x={pad}   y={pad}    width={axisX - pad}     height={axisY - pad}  fill="#FACC15" opacity={0.06} />
        <rect x={pad}   y={axisY}  width={axisX - pad}     height={H - pad - axisY} fill="#F87171" opacity={0.06} />
        <rect x={axisX} y={axisY}  width={W - pad - axisX} height={H - pad - axisY} fill="#60A5FA" opacity={0.06} />

        {/* Grid lines */}
        {[-2, -1, 1, 2].map(t => (
          <line key={`gx${t}`} x1={toX(cx + t * xRange / 3)} y1={pad} x2={toX(cx + t * xRange / 3)} y2={H - pad}
            stroke="#1a1a1a" strokeWidth={1} />
        ))}
        {[-2, -1, 1, 2].map(t => (
          <line key={`gy${t}`} x1={pad} y1={toY(cy + t * yRange / 3)} x2={W - pad} y2={toY(cy + t * yRange / 3)}
            stroke="#1a1a1a" strokeWidth={1} />
        ))}

        {/* Axes */}
        <line x1={axisX} y1={pad}    x2={axisX} y2={H - pad} stroke="#2a2a2a" strokeWidth={1.5} />
        <line x1={pad}   y1={axisY}  x2={W - pad} y2={axisY}  stroke="#2a2a2a" strokeWidth={1.5} />

        {/* Quadrant corner labels */}
        <text x={W - pad - 4} y={pad + 14}   fill="#4ADE80" fontSize={10} textAnchor="end" opacity={0.7} fontWeight="600">Leading ▲</text>
        <text x={pad + 4}     y={pad + 14}   fill="#FACC15" fontSize={10} opacity={0.7} fontWeight="600">▲ Weakening</text>
        <text x={pad + 4}     y={H - pad - 6} fill="#F87171" fontSize={10} opacity={0.7} fontWeight="600">▼ Lagging</text>
        <text x={W - pad - 4} y={H - pad - 6} fill="#60A5FA" fontSize={10} textAnchor="end" opacity={0.7} fontWeight="600">Improving ▼</text>

        {/* Axis labels */}
        <text x={W - pad - 2} y={axisY - 5} fill="#555" fontSize={9} textAnchor="end">RS Strength →</text>
        <text x={axisX + 4}   y={pad + 8}   fill="#555" fontSize={9}>Momentum ↑</text>

        {/* Tails — all tickers, top 3 brighter */}
        {data.map(row => {
          if (!row.tail.length) return null
          const isTop3 = row.rank <= 3
          const isHov  = row.ticker === hovered
          const color  = dotColor(row)
          const pts    = row.tail.map(t => `${toX(t.rs_strength)},${toY(t.rs_momentum)}`).join(' ')
          return (
            <polyline key={`tail-${row.ticker}`} points={pts} fill="none"
              stroke={color}
              strokeWidth={isTop3 || isHov ? 1.5 : 0.8}
              opacity={isHov ? 0.9 : isTop3 ? 0.5 : 0.2}
              strokeDasharray={isTop3 || isHov ? undefined : '3,3'}
            />
          )
        })}

        {/* Dots + labels */}
        {data.map(row => {
          const x      = toX(row.rs_strength)
          const y      = toY(row.rs_momentum)
          const isHov  = row.ticker === hovered
          const isTop3 = row.rank <= 3
          const color  = dotColor(row)
          const r      = isHov ? 7 : isTop3 ? 5.5 : 4

          return (
            <g key={row.ticker} style={{ cursor: 'pointer' }}
              onMouseEnter={(e) => { setHovered(row.ticker); setTooltip({ x: e.clientX, y: e.clientY }) }}
              onMouseMove={(e)  => setTooltip({ x: e.clientX, y: e.clientY })}
              onClick={() => onSelect(row.ticker)}
            >
              {/* Outer glow ring on hover */}
              {isHov && <circle cx={x} cy={y} r={r + 5} fill={color} opacity={0.15} />}
              <circle cx={x} cy={y} r={r} fill={color} opacity={isHov ? 1 : 0.85} />
              <text
                x={x + r + 3} y={y + 4}
                fill={isHov ? '#fff' : isTop3 ? '#ccc' : '#666'}
                fontSize={isHov ? 10 : 9}
                fontWeight={isHov || isTop3 ? '600' : '400'}
              >{row.ticker}</text>
            </g>
          )
        })}
      </svg>

      {/* Floating tooltip */}
      {hovered && hoveredRow && tooltip && (
        <div
          className="fixed z-50 pointer-events-none bg-[#111] border border-[#2a2a2a] rounded px-3 py-2 shadow-xl"
          style={{ left: tooltip.x + 14, top: tooltip.y - 10 }}
        >
          <div className="text-white text-xs font-bold mb-1">
            {hoveredRow.ticker}
            <span className="text-[#555] font-normal ml-1.5 text-[10px]">{TICKER_NAMES[hoveredRow.ticker] ?? ''}</span>
          </div>
          <div className="flex gap-3 text-[10px] font-mono">
            <span className="text-[#555]">Strength</span>
            <span className={hoveredRow.rs_strength >= 100 ? 'text-[#4ADE80]' : 'text-[#F87171]'}>
              {hoveredRow.rs_strength.toFixed(1)}
            </span>
          </div>
          <div className="flex gap-3 text-[10px] font-mono">
            <span className="text-[#555]">Momentum</span>
            <span className={hoveredRow.rs_momentum >= 0 ? 'text-[#4ADE80]' : 'text-[#F87171]'}>
              {hoveredRow.rs_momentum > 0 ? '+' : ''}{hoveredRow.rs_momentum.toFixed(2)}%
            </span>
          </div>
          <div className="mt-1 text-[9px]" style={{ color: dotColor(hoveredRow) }}>
            {hoveredRow.rs_strength >= 100 && hoveredRow.rs_momentum >= 0 ? '● Leading'
             : hoveredRow.rs_strength >= 100 ? '● Improving'
             : hoveredRow.rs_momentum >= 0   ? '● Weakening'
             : '● Lagging'}
          </div>
          <div className="text-[9px] text-[#444] mt-0.5">Click to open chart</div>
        </div>
      )}
    </div>
  )
}

type SortCol = 'rank' | 'rs_slope' | 'rs_momentum' | 'price'

export default function RSDashboard() {
  const setSelectedTicker = useStore(s => s.setSelectedTicker)
  const watchlist      = useStore(s => s.watchlist)

  // Groups state
  const [groups,       setGroups]       = useState<Record<string, string[]>>({})
  const [activeGroup,  setActiveGroup]  = useState<string>('')
  const [newGroupName, setNewGroupName] = useState('')
  const [showNewGroup, setShowNewGroup] = useState(false)

  const [data,    setData]      = useState<RSRow[]>([])
  const [loading, setLoading]   = useState(false)
  const [newTicker, setNewTicker] = useState('')
  const [sortCol,  setSortCol]  = useState<SortCol>('rank')
  const [sortAsc,  setSortAsc]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const tickers = groups[activeGroup] ?? []

  const load = useCallback(async (list: string[]) => {
    if (list.length === 0) return
    setLoading(true)
    setError(null)
    try {
      const rows: RSRow[] = await fetchRS(list)
      setData(rows)
    } catch {
      setError('Failed to fetch RS data')
    } finally {
      setLoading(false)
    }
  }, [])

  // Load groups from backend on mount
  useEffect(() => {
    fetchGroups().then(g => {
      setGroups(g)
      const first = Object.keys(g)[0]
      if (first) setActiveGroup(first)
    }).catch(() => setError('Failed to load groups'))
  }, [])

  // Reload RS data when active group changes
  useEffect(() => {
    if (!activeGroup) return
    const list = groups[activeGroup] ?? []
    setData([])
    load(list)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => load(list), 60_000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [activeGroup, groups, load])

  const handleAdd = async () => {
    const t = newTicker.trim().toUpperCase()
    if (!t || tickers.includes(t) || !activeGroup) return
    setNewTicker('')
    const updated = await addTickerToGroup(activeGroup, t)
    setGroups(updated)
  }

  const handleRemove = async (ticker: string) => {
    if (!activeGroup) return
    setData(prev => prev.filter(r => r.ticker !== ticker))
    const updated = await removeTickerFromGroup(activeGroup, ticker)
    setGroups(updated)
  }

  const handleCreateGroup = async () => {
    const name = newGroupName.trim()
    if (!name) return
    const updated = await createGroup(name)
    setGroups(updated)
    setActiveGroup(name)
    setNewGroupName('')
    setShowNewGroup(false)
  }

  const handleDeleteGroup = async (name: string) => {
    if (!confirm(`Delete group "${name}"?`)) return
    const updated = await deleteGroup(name)
    setGroups(updated)
    const remaining = Object.keys(updated)
    setActiveGroup(remaining[0] ?? '')
    setData([])
  }

  const handleSelect = (ticker: string) => {
    setSelectedTicker(ticker)
    navigator.clipboard.writeText(ticker).catch(() => {})
    window.open(`https://www.tradingview.com/chart/?symbol=${ticker}`, '_blank')
  }

  const sorted = [...data].sort((a, b) => {
    const va = a[sortCol as keyof RSRow] as number
    const vb = b[sortCol as keyof RSRow] as number
    return sortAsc ? va - vb : vb - va
  })

  const toggleSort = (col: SortCol) => {
    if (sortCol === col) setSortAsc(v => !v)
    else { setSortCol(col); setSortAsc(false) }
  }

  const SortHeader = ({ col, label }: { col: SortCol; label: string }) => (
    <button
      onClick={() => toggleSort(col)}
      className={`text-left text-[10px] uppercase tracking-wider hover:text-white transition-colors ${
        sortCol === col ? 'text-[#3B82F6]' : 'text-[#444]'
      }`}
    >
      {label}{sortCol === col ? (sortAsc ? ' ↑' : ' ↓') : ''}
    </button>
  )

  // Watchlist tickers that have a known sector mapping
  const watchlistRS = watchlist
    .map(r => r.ticker)
    .filter(t => SECTOR_MAP[t])
    .slice(0, 8)

  return (
    <div className="flex-1 flex overflow-hidden bg-[#0A0A0C] text-white">

      {/* Left — RS Leaderboard (60%) */}
      <div className="flex flex-col overflow-hidden border-r border-[#1A1A1A]" style={{ width: '60%' }}>

        {/* Group tabs */}
        <div className="flex-shrink-0 flex items-center gap-1 px-3 pt-2 border-b border-[#1A1A1A] overflow-x-auto">
          {Object.keys(groups).map(name => (
            <div key={name} className="flex items-center gap-0.5 flex-shrink-0">
              <button
                onClick={() => setActiveGroup(name)}
                className={`px-3 py-1.5 text-[11px] rounded-t transition-colors ${
                  activeGroup === name
                    ? 'bg-[#1A1A2E] text-[#3B82F6] border-b-2 border-[#3B82F6]'
                    : 'text-[#555] hover:text-[#888]'
                }`}
              >
                {name}
                <span className="ml-1 text-[9px] text-[#333]">{(groups[name] ?? []).length}</span>
              </button>
              {activeGroup === name && (
                <button
                  onClick={() => handleDeleteGroup(name)}
                  className="text-[#333] hover:text-[#F87171] transition-colors px-0.5"
                  title="Delete group"
                >
                  <Trash2 size={10} />
                </button>
              )}
            </div>
          ))}
          {/* New group */}
          {showNewGroup ? (
            <div className="flex items-center gap-1 flex-shrink-0 px-1">
              <input
                autoFocus
                value={newGroupName}
                onChange={e => setNewGroupName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCreateGroup(); if (e.key === 'Escape') setShowNewGroup(false) }}
                placeholder="Group name…"
                className="w-24 bg-[#111] text-white text-[10px] px-2 py-1 rounded border border-[#3B82F6] focus:outline-none placeholder-[#333]"
              />
              <button onClick={handleCreateGroup} className="text-[#3B82F6] hover:text-white transition-colors">
                <Plus size={12} />
              </button>
            </div>
          ) : (
            <button onClick={() => setShowNewGroup(true)}
              className="flex-shrink-0 px-2 py-1.5 text-[#333] hover:text-[#3B82F6] transition-colors"
              title="New group">
              <Plus size={12} />
            </button>
          )}
          <div className="flex-1" />
          {error && <span className="text-[#F87171] text-[10px] flex-shrink-0 pr-2">{error}</span>}
          <button onClick={() => load(tickers)} disabled={loading}
            className="flex-shrink-0 text-[#444] hover:text-white transition-colors disabled:opacity-40 pb-2 pr-1">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Add ticker toolbar */}
        <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 border-b border-[#111]">
          <span className="text-[10px] text-[#444]">25-day · vs SPY</span>
          <div className="flex-1" />
          <div className="flex items-center gap-1">
            <input
              value={newTicker}
              onChange={e => setNewTicker(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="Add ticker…"
              className="w-24 bg-[#111] text-white text-[10px] px-2 py-1 rounded border border-[#1E1E1E] focus:outline-none focus:border-[#3B82F6] placeholder-[#333]"
            />
            <button onClick={handleAdd}
              className="text-[#3B82F6] hover:text-white transition-colors">
              <Plus size={14} />
            </button>
          </div>
        </div>

        {/* Column headers */}
        <div className="flex-shrink-0 grid px-4 py-1.5 border-b border-[#111]"
          style={{ gridTemplateColumns: '28px 52px 110px 56px 56px 80px 56px 20px' }}>
          <SortHeader col="rank"        label="#" />
          <span className="text-[10px] text-[#444] uppercase tracking-wider">Ticker</span>
          <span className="text-[10px] text-[#444] uppercase tracking-wider">Name</span>
          <SortHeader col="price"       label="Price" />
          <SortHeader col="rs_slope"    label="RS 25d" />
          <span className="text-[10px] text-[#444] uppercase tracking-wider">Histogram</span>
          <SortHeader col="rs_momentum" label="Mom" />
          <span />
        </div>

        {/* Rows */}
        <div className="flex-1 overflow-y-auto">
          {loading && data.length === 0 && (
            <div className="text-[#444] text-xs text-center mt-10">Loading RS data…</div>
          )}
          <AnimatePresence>
            {sorted.map((row, idx) => {
              const isTop3   = row.rank <= 3
              const isGreen  = row.slope_5d > 0
              const rankColor = row.rank <= 3 ? '#4ADE80' : row.rank <= 6 ? '#888' : '#444'

              return (
                <motion.div
                  key={row.ticker}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => handleSelect(row.ticker)}
                  className={[
                    'grid items-center px-4 py-2 cursor-pointer border-b border-[#0F0F0F]',
                    'hover:bg-[#111] transition-colors select-none',
                    isTop3 ? 'leading-glow' : '',
                  ].join(' ')}
                  style={{ gridTemplateColumns: '28px 52px 110px 56px 56px 80px 56px 20px' }}
                >
                  <span className="font-mono text-[11px]" style={{ color: rankColor }}>{row.rank}</span>
                  <span className="text-white font-semibold text-[11px] tracking-wide">{row.ticker}</span>
                  <span className="text-[#666] text-[10px] truncate">{TICKER_NAMES[row.ticker] ?? '—'}</span>
                  <span className="text-[#D4D4D4] font-mono text-[11px] tabular-nums">${row.price.toFixed(2)}</span>
                  <div className="flex items-center gap-1">
                    {isGreen
                      ? <TrendingUp size={10} className="text-[#4ADE80] flex-shrink-0" />
                      : <TrendingDown size={10} className="text-[#F87171] flex-shrink-0" />
                    }
                    <span className={`font-mono text-[10px] tabular-nums ${isGreen ? 'text-[#4ADE80]' : 'text-[#F87171]'}`}>
                      {row.rs_slope > 0 ? '+' : ''}{row.rs_slope.toFixed(3)}
                    </span>
                  </div>
                  <RSHistogram values={row.rs_norm} slope5d={row.slope_5d} />
                  <span className={`font-mono text-[10px] tabular-nums ${row.rs_momentum >= 0 ? 'text-[#4ADE80]' : 'text-[#F87171]'}`}>
                    {row.rs_momentum > 0 ? '+' : ''}{row.rs_momentum.toFixed(1)}%
                  </span>
                  <button
                    onClick={e => { e.stopPropagation(); handleRemove(row.ticker) }}
                    className="text-[#333] hover:text-[#F87171] text-xs transition-colors"
                  >×</button>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* Right — RRG + Watchlist RS */}
      <div className="flex flex-col overflow-hidden" style={{ width: '40%' }}>

        {/* RRG Chart */}
        <div className="flex-shrink-0 border-b border-[#1A1A1A] p-4">
          <div className="text-[10px] text-[#444] uppercase tracking-wider mb-3">RS Rotation (RRG)</div>
          {data.length > 0
            ? <RRGChart data={data} onSelect={handleSelect} />
            : <div className="text-[#333] text-xs text-center py-10">Waiting for data…</div>
          }
        </div>

        {/* Active Watchlist RS */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="text-[10px] text-[#444] uppercase tracking-wider mb-3">Watchlist RS vs Sector</div>
          {watchlistRS.length === 0 ? (
            <div className="text-[#333] text-xs">Add tickers to watchlist to see sector RS</div>
          ) : (
            <div className="space-y-1.5">
              {watchlistRS.map(ticker => {
                const sector = SECTOR_MAP[ticker]
                const sectorRow = data.find(r => r.ticker === sector)
                const tickerRS  = data.find(r => r.ticker === ticker)
                const relRS = tickerRS && sectorRow
                  ? tickerRS.rs_strength - sectorRow.rs_strength
                  : null

                return (
                  <div key={ticker}
                    onClick={() => handleSelect(ticker)}
                    className="flex items-center gap-2 bg-[#0D0D0D] border border-[#1A1A1A] rounded px-3 py-2 cursor-pointer hover:border-[#333] transition-colors">
                    <span className="text-white text-xs font-semibold w-12">{ticker}</span>
                    <span className="text-[#444] text-[10px]">vs {sector}</span>
                    <span className="flex-1" />
                    {relRS != null ? (
                      <span className={`font-mono text-[10px] tabular-nums ${relRS >= 0 ? 'text-[#4ADE80]' : 'text-[#F87171]'}`}>
                        {relRS >= 0 ? '+' : ''}{relRS.toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-[#333] text-[10px]">—</span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
