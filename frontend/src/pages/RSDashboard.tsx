import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import * as HoverCard from '@radix-ui/react-hover-card'
import { createChart, ColorType, CrosshairMode, CandlestickSeries, LineSeries, AreaSeries, LineStyle } from 'lightweight-charts'
import { RefreshCw, Plus, Trash2, TrendingUp, TrendingDown } from 'lucide-react'
import { fetchRS, fetchGroups, createGroup, deleteGroup, addTickerToGroup, removeTickerFromGroup, fetchHoldings } from '../api'
import { useStore } from '../store'

interface Candle {
  time:  string
  open:  number
  high:  number
  low:   number
  close: number
}

interface RSRow {
  ticker:      string
  name:        string
  rank:        number
  price:       number
  rs_slope:    number
  slope_5d:    number
  rs_norm:     number[]
  rs_strength: number
  rs_momentum: number
  tail:        { rs_strength: number; rs_momentum: number }[]
  candles:     Candle[]
}

// ─── CandleChart ────────────────────────────────────────────────────────────
function CandleChart({ candles, height = 160 }: { candles: Candle[]; height?: number }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef     = useRef<ReturnType<typeof createChart> | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seriesRef    = useRef<any>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const chart = createChart(containerRef.current, {
      width:  containerRef.current.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: '#171717' },
        textColor:  '#555',
      },
      grid:            { vertLines: { visible: false }, horzLines: { visible: false } },
      crosshair:       { mode: CrosshairMode.Hidden },
      rightPriceScale: { visible: false },
      leftPriceScale:  { visible: false },
      timeScale:       { visible: false, borderVisible: false },
      handleScroll:    false,
      handleScale:     false,
    })
    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#4ADE80', downColor: '#F87171',
      borderUpColor: '#4ADE80', borderDownColor: '#F87171',
      wickUpColor: '#4ADE80', wickDownColor: '#F87171',
    })
    chartRef.current  = chart
    seriesRef.current = series
    const ro = new ResizeObserver(() => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth })
    })
    ro.observe(containerRef.current)
    return () => { ro.disconnect(); chart.remove(); chartRef.current = null; seriesRef.current = null }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height])

  useEffect(() => {
    if (!seriesRef.current || candles.length === 0) return
    seriesRef.current.setData(candles)
    chartRef.current?.timeScale().fitContent()
  }, [candles])

  return <div ref={containerRef} style={{ height }} />
}

// ─── RatioSparkline — SVG polyline of holding/ETF price ratio ───────────────
function RatioSparkline({ values, color = '#4ADE80' }: { values: number[]; color?: string }) {
  if (values.length < 2) return <div style={{ width: 80, height: 28 }} />
  const W = 80, H = 28
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 0.0001
  const pts = values
    .map((v, i) => `${(i / (values.length - 1)) * W},${H - ((v - min) / range) * (H - 4) - 2}`)
    .join(' ')
  return (
    <svg width={W} height={H} className="overflow-visible flex-shrink-0">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

// ─── NormalizedChart — Base-100 comparison chart rendered inside HoverCard ───
function NormalizedChart({
  holdingTicker,
  etfTicker,
  holdingCandles,
  etfCandles,
}: {
  holdingTicker:  string
  etfTicker:      string
  holdingCandles: Candle[]
  etfCandles:     Candle[]
}) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current || holdingCandles.length === 0 || etfCandles.length === 0) return

    const chart = createChart(containerRef.current, {
      width:  280,
      height: 150,
      layout: {
        background: { type: ColorType.Solid, color: '#0A0A0A' },
        textColor:  '#555',
      },
      grid:            { vertLines: { visible: false }, horzLines: { visible: false } },
      crosshair:       { mode: CrosshairMode.Normal },
      rightPriceScale: { visible: false },
      leftPriceScale:  { visible: false },
      timeScale:       { visible: false, borderVisible: false },
      handleScroll:    false,
      handleScale:     false,
    })

    const etfByTime = new Map(etfCandles.map(c => [c.time, c.close]))
    const aligned   = holdingCandles.filter(c => etfByTime.has(c.time))
    if (aligned.length < 2) { chart.remove(); return }

    const base    = aligned[0].close
    const etfBase = etfByTime.get(aligned[0].time)!

    // Stock — AreaSeries: solid green line with gradient fill
    const areaSeries = chart.addSeries(AreaSeries, {
      lineColor:   '#22C55E',
      lineWidth:   2,
      topColor:    'rgba(34, 197, 94, 0.25)',
      bottomColor: 'rgba(34, 197, 94, 0)',
    })
    areaSeries.setData(
      aligned.map(c => ({ time: c.time as import('lightweight-charts').Time, value: (c.close / base) * 100 }))
    )

    // Sector ETF — dashed gray LineSeries benchmark
    const etfSeries = chart.addSeries(LineSeries, {
      color:     '#71717A',
      lineWidth: 2,
      lineStyle: LineStyle.Dashed,
    })
    etfSeries.setData(
      aligned.map(c => ({ time: c.time as import('lightweight-charts').Time, value: (etfByTime.get(c.time)! / etfBase) * 100 }))
    )

    chart.timeScale().fitContent()
    return () => chart.remove()   // cleanup on unmount — prevents memory leak
  }, [holdingCandles, etfCandles])

  return (
    <div className="rounded-xl border border-[#2A2A2A] bg-[#0A0A0A] shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="px-3 pt-2.5 pb-2 border-b border-[#1A1A1A] flex items-center gap-2">
        <span className="h-1.5 w-4 rounded-full bg-[#22C55E] flex-shrink-0" />
        <span className="text-white text-xs font-semibold">{holdingTicker}</span>
        <span className="text-[#444] text-[10px]">vs</span>
        <span className="h-px w-4 bg-[#71717A] flex-shrink-0" style={{ borderTop: '1px dashed #71717A' }} />
        <span className="text-zinc-500 text-xs">{etfTicker}</span>
        <span className="ml-auto text-[#333] text-[10px] font-mono">Base 100</span>
      </div>
      <div ref={containerRef} style={{ width: 280, height: 150 }} />
    </div>
  )
}

// ─── HoldingsPanel — sidebar table for selected ETF's top holdings ───────────
function HoldingsPanel({
  etfRow,
  holdingRows,
  loading,
}: {
  etfRow:      RSRow | null
  holdingRows: RSRow[]
  loading:     boolean
}) {
  // ResizeObserver to toggle Price column visibility
  const panelRef    = useRef<HTMLDivElement>(null)
  const [showPrice, setShowPrice] = useState(true)

  useEffect(() => {
    if (!panelRef.current) return
    const ro = new ResizeObserver(([entry]) => setShowPrice(entry.contentRect.width > 230))
    ro.observe(panelRef.current)
    return () => ro.disconnect()
  }, [])

  if (!etfRow) {
    return (
      <div ref={panelRef} className="flex-1 flex items-center justify-center p-4">
        <p className="text-zinc-700 text-xs text-center">Click an ETF card<br />to drill into holdings</p>
      </div>
    )
  }

  const etfByTime = new Map(etfRow.candles.slice(-25).map(c => [c.time, c.close]))
  const etfPct1d  = etfRow.candles.length >= 2
    ? ((etfRow.candles.at(-1)!.close - etfRow.candles.at(-2)!.close) / etfRow.candles.at(-2)!.close) * 100
    : 0

  // Grid columns: Ticker | Price (optional) | Sector Delta | Ratio Trend
  const cols = showPrice ? '52px 58px 1fr 80px' : '52px 1fr 80px'

  return (
    <div ref={panelRef} className="flex-1 overflow-y-auto p-3">
      {/* Section header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] text-zinc-600 uppercase tracking-wider font-medium">
          {etfRow.ticker} · Top Holdings
        </span>
        {loading && <RefreshCw size={10} className="animate-spin text-zinc-700" />}
      </div>

      {/* Column labels */}
      <div className="grid gap-2 px-2 mb-1" style={{ gridTemplateColumns: cols }}>
        <span className="text-[9px] text-zinc-700 uppercase tracking-wider">Ticker</span>
        {showPrice && <span className="text-[9px] text-zinc-700 uppercase tracking-wider">Price</span>}
        <span className="text-[9px] text-zinc-700 uppercase tracking-wider">Sector Δ</span>
        <span className="text-[9px] text-zinc-700 uppercase tracking-wider">Ratio 25d</span>
      </div>

      {/* Rows — each wrapped in a Radix HoverCard */}
      <div className="space-y-1">
        {holdingRows.map(h => {
          const hPct1d = h.candles.length >= 2
            ? ((h.candles.at(-1)!.close - h.candles.at(-2)!.close) / h.candles.at(-2)!.close) * 100
            : 0
          const delta = hPct1d - etfPct1d
          const deltaColor = delta >= 0 ? 'text-[#22C55E]' : 'text-[#F87171]'

          const ratioValues = h.candles
            .filter(c => etfByTime.has(c.time))
            .slice(-25)
            .map(c => c.close / etfByTime.get(c.time)!)

          return (
            <HoverCard.Root key={h.ticker} openDelay={200} closeDelay={100}>
              <HoverCard.Trigger asChild>
                <div
                  className="grid items-center gap-2 px-2 py-2 rounded-lg border border-[#1A1A1A]
                             bg-white/5 hover:bg-white/[0.07] hover:border-[#2A2A2A]
                             transition-all duration-150 cursor-default select-none"
                  style={{ gridTemplateColumns: cols }}
                >
                  <span className="text-white font-mono text-[11px] font-semibold">{h.ticker}</span>

                  {showPrice && (
                    <span className="text-zinc-400 font-mono text-[10px] tabular-nums">
                      ${h.price.toFixed(2)}
                    </span>
                  )}

                  <div className="flex items-center gap-1 min-w-0">
                    {delta >= 0
                      ? <TrendingUp   size={9} className="text-[#22C55E] flex-shrink-0" />
                      : <TrendingDown size={9} className="text-[#F87171] flex-shrink-0" />}
                    <span className={`font-mono text-[10px] tabular-nums ${deltaColor}`}>
                      {delta >= 0 ? '+' : ''}{delta.toFixed(2)}%
                    </span>
                  </div>

                  <RatioSparkline values={ratioValues} color={delta >= 0 ? '#22C55E' : '#F87171'} />
                </div>
              </HoverCard.Trigger>

              <HoverCard.Portal>
                <HoverCard.Content
                  side="left"
                  sideOffset={12}
                  align="center"
                  className="z-50 outline-none"
                >
                  <NormalizedChart
                    holdingTicker={h.ticker}
                    etfTicker={etfRow.ticker}
                    holdingCandles={h.candles.slice(-25)}
                    etfCandles={etfRow.candles.slice(-25)}
                  />
                </HoverCard.Content>
              </HoverCard.Portal>
            </HoverCard.Root>
          )
        })}
      </div>

      {!loading && holdingRows.length === 0 && (
        <p className="text-zinc-700 text-xs mt-3 px-2">No holdings data — may not be an ETF</p>
      )}
    </div>
  )
}

// ─── RSHistogram ─────────────────────────────────────────────────────────────
function RSHistogram({ values, slope5d }: { values: number[]; slope5d: number }) {
  const min   = Math.min(...values)
  const max   = Math.max(...values)
  const range = max - min || 1
  const color = slope5d > 0 ? '#4ADE80' : '#F87171'
  return (
    <svg width={75} height={22} className="overflow-visible flex-shrink-0">
      {values.map((v, i) => {
        const h = Math.max(2, ((v - min) / range) * 18)
        return <rect key={i} x={i * 3} y={20 - h} width={2} height={h} fill={color} opacity={0.7 + (i / values.length) * 0.3} />
      })}
    </svg>
  )
}

// ─── TickerCard ───────────────────────────────────────────────────────────────
function TickerCard({
  row,
  holdings,
  isSelected,
  onSelect,
  onRemove,
}: {
  row:        RSRow
  holdings:   string[]
  isSelected: boolean
  onSelect:   (t: string) => void
  onRemove:   (t: string) => void
}) {
  const isGreen  = row.slope_5d > 0
  const visibleH = holdings.slice(0, 3)
  const extraH   = holdings.length - visibleH.length

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.18 }}
      onClick={() => onSelect(row.ticker)}
      className={[
        'rounded-xl bg-[#171717] border transition-all duration-300 shadow-2xl overflow-hidden cursor-pointer',
        isSelected
          ? 'border-blue-500/60 shadow-[0_0_20px_0_rgba(59,130,246,0.15)]'
          : row.rank <= 3
            ? 'border-l-2 border-[#4ADE80]/40 hover:border-[#4ADE80]/70'
            : 'border-white/10 hover:border-blue-500/40',
      ].join(' ')}
    >
      {/* Top row */}
      <div className="px-4 pt-4 pb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-white font-bold text-base leading-tight tracking-wide">{row.ticker}</div>
          <div className="text-zinc-500 text-[11px] truncate mt-0.5">{row.name}</div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-white font-mono text-sm tabular-nums">${row.price.toFixed(2)}</div>
          <div className="text-zinc-700 text-[10px] tabular-nums">#{row.rank}</div>
        </div>
      </div>

      {/* Candlestick chart */}
      <div className="overflow-hidden">
        <CandleChart candles={row.candles} height={160} />
      </div>

      {/* Data strip */}
      <div className="px-4 py-3 flex items-center gap-2">
        <div className="flex items-center gap-1 flex-shrink-0">
          {isGreen
            ? <TrendingUp  size={10} className="text-[#4ADE80]" />
            : <TrendingDown size={10} className="text-[#F87171]" />}
          <span className={`font-mono text-[10px] tabular-nums ${isGreen ? 'text-[#4ADE80]' : 'text-[#F87171]'}`}>
            {row.rs_slope > 0 ? '+' : ''}{row.rs_slope.toFixed(3)}
          </span>
        </div>
        <RSHistogram values={row.rs_norm} slope5d={row.slope_5d} />
        <div className="flex items-center gap-1 flex-1 overflow-hidden min-w-0">
          {visibleH.map(h => (
            <span key={h} className="text-[9px] font-mono text-zinc-400 px-1.5 py-0.5 rounded bg-white/5 border border-white/10 flex-shrink-0">
              {h}
            </span>
          ))}
          {extraH > 0 && <span className="text-[9px] text-zinc-600 flex-shrink-0">+{extraH}</span>}
        </div>
        <button
          onClick={e => { e.stopPropagation(); onRemove(row.ticker) }}
          className="text-zinc-700 hover:text-red-400 transition-colors text-sm flex-shrink-0 ml-1 leading-none"
        >×</button>
      </div>
    </motion.div>
  )
}

// ─── RRGChart ─────────────────────────────────────────────────────────────────
function RRGChart({ data, onSelect }: { data: RSRow[]; onSelect: (ticker: string) => void }) {
  const [hovered, setHovered] = useState<string | null>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number } | null>(null)

  const W = 420, H = 300, pad = 48
  const allX = data.map(d => d.rs_strength)
  const allY = data.map(d => d.rs_momentum)
  const cx = 100, cy = 0
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
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="overflow-visible"
        onMouseLeave={() => { setHovered(null); setTooltip(null) }}>
        <rect x={axisX} y={pad}   width={W - pad - axisX} height={axisY - pad}       fill="#4ADE80" opacity={0.06} />
        <rect x={pad}   y={pad}   width={axisX - pad}     height={axisY - pad}       fill="#FACC15" opacity={0.06} />
        <rect x={pad}   y={axisY} width={axisX - pad}     height={H - pad - axisY}   fill="#F87171" opacity={0.06} />
        <rect x={axisX} y={axisY} width={W - pad - axisX} height={H - pad - axisY}   fill="#60A5FA" opacity={0.06} />
        {[-2,-1,1,2].map(t => (
          <line key={`gx${t}`} x1={toX(cx+t*xRange/3)} y1={pad} x2={toX(cx+t*xRange/3)} y2={H-pad} stroke="#1a1a1a" strokeWidth={1} />
        ))}
        {[-2,-1,1,2].map(t => (
          <line key={`gy${t}`} x1={pad} y1={toY(cy+t*yRange/3)} x2={W-pad} y2={toY(cy+t*yRange/3)} stroke="#1a1a1a" strokeWidth={1} />
        ))}
        <line x1={axisX} y1={pad}   x2={axisX} y2={H-pad}   stroke="#2a2a2a" strokeWidth={1.5} />
        <line x1={pad}   y1={axisY} x2={W-pad} y2={axisY}   stroke="#2a2a2a" strokeWidth={1.5} />
        <text x={W-pad-4} y={pad+14}    fill="#4ADE80" fontSize={10} textAnchor="end" opacity={0.7} fontWeight="600">Leading ▲</text>
        <text x={pad+4}   y={pad+14}    fill="#FACC15" fontSize={10} opacity={0.7} fontWeight="600">▲ Weakening</text>
        <text x={pad+4}   y={H-pad-6}   fill="#F87171" fontSize={10} opacity={0.7} fontWeight="600">▼ Lagging</text>
        <text x={W-pad-4} y={H-pad-6}   fill="#60A5FA" fontSize={10} textAnchor="end" opacity={0.7} fontWeight="600">Improving ▼</text>
        <text x={W-pad-2} y={axisY-5}   fill="#555" fontSize={9} textAnchor="end">RS Strength →</text>
        <text x={axisX+4} y={pad+8}     fill="#555" fontSize={9}>Momentum ↑</text>
        {data.map(row => {
          if (!row.tail.length) return null
          const isTop3 = row.rank <= 3
          const isHov  = row.ticker === hovered
          const color  = dotColor(row)
          const pts    = row.tail.map(t => `${toX(t.rs_strength)},${toY(t.rs_momentum)}`).join(' ')
          return (
            <polyline key={`tail-${row.ticker}`} points={pts} fill="none" stroke={color}
              strokeWidth={isTop3 || isHov ? 1.5 : 0.8}
              opacity={isHov ? 0.9 : isTop3 ? 0.5 : 0.2}
              strokeDasharray={isTop3 || isHov ? undefined : '3,3'} />
          )
        })}
        {data.map(row => {
          const x = toX(row.rs_strength), y = toY(row.rs_momentum)
          const isHov = row.ticker === hovered
          const isTop3 = row.rank <= 3
          const color = dotColor(row)
          const r = isHov ? 7 : isTop3 ? 5.5 : 4
          return (
            <g key={row.ticker} style={{ cursor: 'pointer' }}
              onMouseEnter={e => { setHovered(row.ticker); setTooltip({ x: e.clientX, y: e.clientY }) }}
              onMouseMove={e  => setTooltip({ x: e.clientX, y: e.clientY })}
              onClick={() => onSelect(row.ticker)}
            >
              {isHov && <circle cx={x} cy={y} r={r+5} fill={color} opacity={0.15} />}
              <circle cx={x} cy={y} r={r} fill={color} opacity={isHov ? 1 : 0.85} />
              <text x={x+r+3} y={y+4} fill={isHov ? '#fff' : isTop3 ? '#ccc' : '#666'}
                fontSize={isHov ? 10 : 9} fontWeight={isHov || isTop3 ? '600' : '400'}>{row.ticker}</text>
            </g>
          )
        })}
      </svg>
      {hovered && hoveredRow && tooltip && (
        <div className="fixed z-50 pointer-events-none bg-[#111] border border-[#2a2a2a] rounded px-3 py-2 shadow-xl"
          style={{ left: tooltip.x + 14, top: tooltip.y - 10 }}>
          <div className="text-white text-xs font-bold mb-1">
            {hoveredRow.ticker}
            <span className="text-[#555] font-normal ml-1.5 text-[10px]">{hoveredRow.name}</span>
          </div>
          <div className="flex gap-3 text-[10px] font-mono">
            <span className="text-[#555]">Strength</span>
            <span className={hoveredRow.rs_strength >= 100 ? 'text-[#4ADE80]' : 'text-[#F87171]'}>{hoveredRow.rs_strength.toFixed(1)}</span>
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
          <div className="text-[9px] text-[#444] mt-0.5">Click to drill into holdings</div>
        </div>
      )}
    </div>
  )
}

type SortCol = 'rank' | 'rs_slope' | 'rs_momentum' | 'price'

// ─── RSDashboard ─────────────────────────────────────────────────────────────
export default function RSDashboard() {
  const setSelectedTicker = useStore(s => s.setSelectedTicker)

  // Groups
  const [groups,       setGroups]       = useState<Record<string, string[]>>({})
  const [activeGroup,  setActiveGroup]  = useState<string>('')
  const [newGroupName, setNewGroupName] = useState('')
  const [showNewGroup, setShowNewGroup] = useState(false)

  // RS data
  const [data,    setData]    = useState<RSRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  // Holdings cache
  const [holdings, setHoldings] = useState<Record<string, string[]>>({})

  // Drill-down: which ETF card is selected
  const [activeSector,   setActiveSector]   = useState<string | null>(null)
  const [holdingData,    setHoldingData]    = useState<RSRow[]>([])
  const [loadingHoldings, setLoadingHoldings] = useState(false)

  // UI
  const [newTicker, setNewTicker] = useState('')
  const [sortCol,   setSortCol]   = useState<SortCol>('rank')
  const [sortAsc,   setSortAsc]   = useState(true)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const tickers  = groups[activeGroup] ?? []

  const load = useCallback(async (list: string[]) => {
    if (list.length === 0) return
    setLoading(true); setError(null)
    try { setData(await fetchRS(list)) }
    catch { setError('Failed to fetch RS data') }
    finally { setLoading(false) }
  }, [])

  // Load groups on mount
  useEffect(() => {
    fetchGroups().then(g => {
      setGroups(g)
      const first = Object.keys(g)[0]
      if (first) setActiveGroup(first)
    }).catch(() => setError('Failed to load groups'))
  }, [])

  // Reload when active group changes
  useEffect(() => {
    if (!activeGroup) return
    const list = groups[activeGroup] ?? []
    setData([]); setActiveSector(null); setHoldingData([])
    load(list)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => load(list), 60_000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [activeGroup, groups, load])

  // Fetch holdings for current group
  useEffect(() => {
    const list = groups[activeGroup] ?? []
    if (list.length === 0) return
    fetchHoldings(list).then(setHoldings).catch(() => {})
  }, [activeGroup, groups])

  // Fetch RS for active sector's holdings when sector or holdings change
  useEffect(() => {
    if (!activeSector) return
    const holdTickers = holdings[activeSector] ?? []
    if (holdTickers.length === 0) return
    setLoadingHoldings(true)
    fetchRS(holdTickers)
      .then(setHoldingData)
      .catch(() => {})
      .finally(() => setLoadingHoldings(false))
  }, [activeSector, holdings])

  const handleAdd = async () => {
    if (!activeGroup) return
    const symbols = newTicker.split(/[\s,]+/).map(s => s.trim().toUpperCase()).filter(s => s && !tickers.includes(s))
    if (symbols.length === 0) return
    setNewTicker('')
    let updated = groups
    for (const sym of symbols) updated = await addTickerToGroup(activeGroup, sym)
    setGroups(updated)
  }

  const handleRemove = async (ticker: string) => {
    if (!activeGroup) return
    setData(prev => prev.filter(r => r.ticker !== ticker))
    if (activeSector === ticker) { setActiveSector(null); setHoldingData([]) }
    setGroups(await removeTickerFromGroup(activeGroup, ticker))
  }

  const handleCreateGroup = async () => {
    const name = newGroupName.trim()
    if (!name) return
    const updated = await createGroup(name)
    setGroups(updated); setActiveGroup(name); setNewGroupName(''); setShowNewGroup(false)
  }

  const handleDeleteGroup = async (name: string) => {
    if (!confirm(`Delete group "${name}"?`)) return
    const updated = await deleteGroup(name)
    setGroups(updated)
    setActiveGroup(Object.keys(updated)[0] ?? '')
    setData([]); setActiveSector(null); setHoldingData([])
  }

  // Card click: set active sector for drill-down
  const handleCardClick = (ticker: string) => {
    setSelectedTicker(ticker)
    setActiveSector(prev => prev === ticker ? null : ticker) // toggle off on second click
  }

  const sorted = [...data].sort((a, b) => {
    const va = a[sortCol as keyof RSRow] as number
    const vb = b[sortCol as keyof RSRow] as number
    return sortAsc ? va - vb : vb - va
  })

  const activeETFRow = data.find(r => r.ticker === activeSector) ?? null

  return (
    <div className="flex-1 flex overflow-hidden bg-[#0A0A0A] text-white font-sans">

      {/* ── Left: Card Grid (60%) ── */}
      <div className="flex flex-col overflow-hidden border-r border-[#1A1A1A]" style={{ width: '60%' }}>

        {/* Group tabs */}
        <div className="flex-shrink-0 flex items-center border-b border-[#1A1A1A] px-3 pt-2">
          <div className="flex items-center gap-1 overflow-x-auto min-w-0 flex-1 scrollbar-none">
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
                {activeGroup === name && name !== 'Sector ETFs' && (
                  <button onClick={() => handleDeleteGroup(name)}
                    className="text-[#333] hover:text-[#F87171] transition-colors px-0.5 pb-1">
                    <Trash2 size={10} />
                  </button>
                )}
              </div>
            ))}
            {showNewGroup ? (
              <div className="flex items-center gap-1 flex-shrink-0 px-1 pb-1">
                <input autoFocus value={newGroupName}
                  onChange={e => setNewGroupName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCreateGroup(); if (e.key === 'Escape') setShowNewGroup(false) }}
                  placeholder="Group name…"
                  className="w-24 bg-[#111] text-white text-[10px] px-2 py-1 rounded border border-[#3B82F6] focus:outline-none placeholder-[#333]" />
                <button onClick={handleCreateGroup} className="text-[#3B82F6] hover:text-white transition-colors">
                  <Plus size={12} />
                </button>
              </div>
            ) : (
              <button onClick={() => setShowNewGroup(true)}
                className="flex-shrink-0 px-2 py-1.5 pb-2 text-[#333] hover:text-[#3B82F6] transition-colors">
                <Plus size={12} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 pl-2 pb-1">
            {error && <span className="text-[#F87171] text-[10px]">{error}</span>}
            <button onClick={() => load(tickers)} disabled={loading}
              className="text-[#444] hover:text-white transition-colors disabled:opacity-40">
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2 border-b border-[#111]">
          <span className="text-zinc-600 text-[10px]">
            25d · vs SPY{sorted.length > 0 ? ` · ${sorted.length} tickers` : ''}
          </span>
          {activeSector && (
            <span className="text-[10px] text-blue-400/70 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500/60" />
              {activeSector} selected
              <button onClick={() => { setActiveSector(null); setHoldingData([]) }}
                className="text-zinc-600 hover:text-zinc-400 ml-0.5">×</button>
            </span>
          )}
          <div className="flex-1" />
          <select
            value={`${sortCol}:${sortAsc ? 'asc' : 'desc'}`}
            onChange={e => {
              const [col, dir] = e.target.value.split(':')
              setSortCol(col as SortCol); setSortAsc(dir === 'asc')
            }}
            className="bg-[#111] text-zinc-400 text-[10px] border border-[#1E1E1E] rounded px-2 py-1 focus:outline-none focus:border-[#3B82F6] cursor-pointer"
          >
            <option value="rank:asc">Sort: Rank</option>
            <option value="rs_slope:desc">Sort: RS Slope ↓</option>
            <option value="rs_momentum:desc">Sort: Momentum ↓</option>
            <option value="price:desc">Sort: Price ↓</option>
          </select>
          <div className="flex items-center gap-1">
            <input
              value={newTicker}
              onChange={e => setNewTicker(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="NVDA, AMD…"
              className="w-36 bg-[#111] text-white text-[10px] px-2 py-1 rounded border border-[#1E1E1E] focus:outline-none focus:border-[#3B82F6] placeholder-[#333]"
            />
            <button onClick={handleAdd} className="text-[#3B82F6] hover:text-white transition-colors">
              <Plus size={14} />
            </button>
          </div>
        </div>

        {/* Card grid */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {loading && data.length === 0 && (
            <div className="text-zinc-600 text-xs text-center mt-10">Loading RS data…</div>
          )}
          <AnimatePresence>
            {sorted.length > 0 && (
              <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
                {sorted.map(row => (
                  <TickerCard
                    key={row.ticker}
                    row={row}
                    holdings={holdings[row.ticker] ?? []}
                    isSelected={activeSector === row.ticker}
                    onSelect={handleCardClick}
                    onRemove={handleRemove}
                  />
                ))}
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Right: RRG + Holdings Drill-down (40%) ── */}
      <div className="flex flex-col overflow-hidden" style={{ width: '40%' }}>

        {/* RRG */}
        <div className="flex-shrink-0 border-b border-[#1A1A1A] p-4">
          <div className="text-[10px] text-[#444] uppercase tracking-wider mb-2">RS Rotation (RRG)</div>
          {data.length > 0
            ? <RRGChart data={data} onSelect={handleCardClick} />
            : <div className="text-[#333] text-xs text-center py-8">Waiting for data…</div>}
        </div>

        {/* Holdings panel (drill-down) */}
        <div className="flex-1 overflow-hidden flex flex-col bg-[#0A0A0A]/80 backdrop-blur-sm">
          <HoldingsPanel
            etfRow={activeETFRow}
            holdingRows={holdingData}
            loading={loadingHoldings}
          />
        </div>
      </div>
    </div>
  )
}
