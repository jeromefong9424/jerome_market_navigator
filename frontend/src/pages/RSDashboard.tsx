import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence, Reorder, useDragControls } from 'framer-motion'
import * as HoverCard from '@radix-ui/react-hover-card'
import * as Popover from '@radix-ui/react-popover'
import { createChart, ColorType, CrosshairMode, CandlestickSeries } from 'lightweight-charts'
import { RefreshCw, Plus, Trash2, TrendingUp, TrendingDown, Sparkles, ChevronDown, ChevronUp, Wand2, GripVertical, ChevronsUpDown, BarChart3, TableProperties, LayoutGrid } from 'lucide-react'
import { fetchRS, fetchGroups, createGroup, deleteGroup, addTickerToGroup, removeTickerFromGroup, fetchHoldings, fetchInfo, type CompanyInfo } from '../api'
import { useStore } from '../store'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { useIsTouchDevice } from '../hooks/useIsTouchDevice'

// ─── Section types ────────────────────────────────────────────────────────────
type SectionName = 'Indices' | 'Sector ETFs' | 'Thematic ETFs'
const SECTIONS: SectionName[] = ['Indices', 'Sector ETFs', 'Thematic ETFs']

const DEFAULT_SECTION_MAP: Record<string, SectionName> = {
  // Indices
  SPY: 'Indices', QQQ: 'Indices', IWM: 'Indices', DIA: 'Indices',
  VTI: 'Indices', MDY: 'Indices', IJR: 'Indices', IEF: 'Indices', TLT: 'Indices',
  // Sector ETFs
  XLK: 'Sector ETFs', XLE: 'Sector ETFs', XLF: 'Sector ETFs', XLV: 'Sector ETFs',
  XLI: 'Sector ETFs', XLY: 'Sector ETFs', XLP: 'Sector ETFs', XLU: 'Sector ETFs',
  XLB: 'Sector ETFs', XLRE: 'Sector ETFs', KRE: 'Sector ETFs', OIH: 'Sector ETFs',
  XOP: 'Sector ETFs', ITA: 'Sector ETFs', XHB: 'Sector ETFs', ITB: 'Sector ETFs',
  XRT: 'Sector ETFs', IBB: 'Sector ETFs', SMH: 'Sector ETFs', GDX: 'Sector ETFs',
  GDXJ: 'Sector ETFs', COPX: 'Sector ETFs', MOO: 'Sector ETFs', PHO: 'Sector ETFs',
  JETS: 'Sector ETFs', XBI: 'Sector ETFs', FCG: 'Sector ETFs',
  // Thematic ETFs (everything else)
  AIQ: 'Thematic ETFs', DTCR: 'Thematic ETFs', CLOU: 'Thematic ETFs', WCLD: 'Thematic ETFs',
  ARKW: 'Thematic ETFs', BOTZ: 'Thematic ETFs', HUMN: 'Thematic ETFs', UFO: 'Thematic ETFs',
  ARKX: 'Thematic ETFs', SHLD: 'Thematic ETFs', CIBR: 'Thematic ETFs', HACK: 'Thematic ETFs',
  URNM: 'Thematic ETFs', NLR: 'Thematic ETFs', GRID: 'Thematic ETFs', ICLN: 'Thematic ETFs',
  LIT: 'Thematic ETFs', DRIV: 'Thematic ETFs', PAVE: 'Thematic ETFs', FINX: 'Thematic ETFs',
  IBIT: 'Thematic ETFs', BKCH: 'Thematic ETFs', ARKG: 'Thematic ETFs', ARKK: 'Thematic ETFs',
  ARKQ: 'Thematic ETFs', REMX: 'Thematic ETFs', IGV: 'Thematic ETFs', GLD: 'Thematic ETFs', SLV: 'Thematic ETFs',
}

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

// ─── HoldingHoverRow — single holding row with lazy company info ─────────────
function HoldingCardContent({ row, etfTicker, hPct1d, delta, info }: {
  row: RSRow; etfTicker: string; hPct1d: number; delta: number; info: CompanyInfo | null
}) {
  return (
    <div className="rounded-xl border border-[#2A2A2A] bg-[#0D0D0D] shadow-2xl overflow-hidden" style={{ width: 280 }}>
      <div className="px-3 py-2 border-b border-[#1A1A1A] flex items-center justify-between">
        <div className="min-w-0">
          <span className="text-white text-[11px] font-bold">{row.ticker}</span>
          {info && <span className="text-zinc-500 text-[10px] ml-1.5">{info.name}</span>}
        </div>
        <span className="text-zinc-600 text-[9px] flex-shrink-0 ml-2">3mo · daily</span>
      </div>
      <CandleChart candles={row.candles} height={140} />
      <div className="px-3 py-1.5 border-t border-[#1A1A1A] flex items-center gap-3">
        <span className="text-[9px] text-zinc-600">
          1D <span className={delta >= 0 ? 'text-emerald-400' : 'text-rose-500'}>
            {delta >= 0 ? '+' : ''}{hPct1d.toFixed(2)}%
          </span>
        </span>
        <span className="text-[9px] text-zinc-600">
          vs {etfTicker} <span className={delta >= 0 ? 'text-emerald-400' : 'text-rose-500'}>
            {delta >= 0 ? '+' : ''}{delta.toFixed(2)}%
          </span>
        </span>
      </div>
      {info && (info.summary || info.sector) && (
        <div className="px-3 py-2 border-t border-[#1A1A1A] space-y-1">
          {info.sector && (
            <div className="flex items-center gap-1.5">
              <span className="text-[8px] font-mono uppercase tracking-wider text-zinc-600 bg-white/[0.04] border border-white/[0.06] px-1.5 py-0.5 rounded">
                {info.sector}
              </span>
              {info.industry && (
                <span className="text-[8px] text-zinc-600 truncate">{info.industry}</span>
              )}
            </div>
          )}
          {info.summary && (
            <p className="text-[10px] text-zinc-500 leading-relaxed">{info.summary}</p>
          )}
        </div>
      )}
      {!info && (
        <div className="px-3 py-2 border-t border-[#1A1A1A]">
          <div className="h-2 rounded w-3/4 shimmer-line" />
        </div>
      )}
    </div>
  )
}

function HoldingHoverRow({
  row, etfTicker, hPct1d, delta, deltaColor, ratioValues, cols, showPrice,
}: {
  row: RSRow; etfTicker: string; hPct1d: number; delta: number; deltaColor: string
  ratioValues: number[]; cols: string; showPrice: boolean
}) {
  const [info, setInfo] = useState<CompanyInfo | null>(null)
  const isTouch = useIsTouchDevice()
  const isNarrow = !useMediaQuery('(min-width: 640px)')

  const handleOpen = (open: boolean) => {
    if (!open || info !== null) return
    fetchInfo(row.ticker).then(setInfo).catch(() => {})
  }

  const triggerRow = (
    <div
      className="grid items-center gap-2 px-2 py-2 rounded-lg border border-[#1A1A1A]
                 bg-white/5 hover:bg-white/[0.07] hover:border-[#2A2A2A]
                 transition-all duration-150 cursor-default select-none"
      style={{ gridTemplateColumns: cols }}
    >
      <span className="text-white font-mono text-[11px] font-semibold">{row.ticker}</span>
      {showPrice && (
        <span className="text-zinc-400 font-mono text-[10px] tabular-nums">
          ${row.price.toFixed(2)}
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
  )

  // Touch devices: use Popover (tap to open)
  if (isTouch) {
    return (
      <Popover.Root onOpenChange={handleOpen}>
        <Popover.Trigger asChild>{triggerRow}</Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            side={isNarrow ? 'bottom' : 'left'}
            sideOffset={8}
            align="center"
            className="z-50 outline-none"
          >
            <HoldingCardContent row={row} etfTicker={etfTicker} hPct1d={hPct1d} delta={delta} info={info} />
            <Popover.Arrow className="fill-[#2A2A2A]" />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    )
  }

  // Desktop: use HoverCard (hover to open)
  return (
    <HoverCard.Root openDelay={200} closeDelay={100} onOpenChange={handleOpen}>
      <HoverCard.Trigger asChild>{triggerRow}</HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content side="left" sideOffset={12} align="center" className="z-50 outline-none">
          <HoldingCardContent row={row} etfTicker={etfTicker} hPct1d={hPct1d} delta={delta} info={info} />
          <HoverCard.Arrow className="fill-[#2A2A2A]" />
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
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
      <div ref={panelRef} className="flex-1 flex flex-col items-center justify-center p-6 gap-3">
        <div className="w-10 h-10 rounded-xl border border-white/[0.06] bg-white/[0.02] flex items-center justify-center">
          <TrendingUp size={16} className="text-zinc-700" />
        </div>
        <p className="text-zinc-600 text-[11px] text-center leading-relaxed">Select an ETF row<br />to view top holdings</p>
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
        <div className="h-1 w-1 rounded-full bg-blue-500" />
        <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-medium">
          {etfRow.ticker} · Top Holdings
        </span>
        {loading && <RefreshCw size={10} className="animate-spin text-zinc-700" />}
      </div>

      {/* Column labels */}
      <div className="grid gap-2 px-2 mb-1.5" style={{ gridTemplateColumns: cols }}>
        <span className="text-[8px] text-zinc-600 uppercase tracking-widest font-medium">Ticker</span>
        {showPrice && <span className="text-[8px] text-zinc-600 uppercase tracking-widest font-medium">Price</span>}
        <span className="text-[8px] text-zinc-600 uppercase tracking-widest font-medium">Sector Δ</span>
        <span className="text-[8px] text-zinc-600 uppercase tracking-widest font-medium">Ratio 25d</span>
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
            <HoldingHoverRow
              key={h.ticker}
              row={h}
              etfTicker={etfRow.ticker}
              hPct1d={hPct1d}
              delta={delta}
              deltaColor={deltaColor}
              ratioValues={ratioValues}
              cols={cols}
              showPrice={showPrice}
            />
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
// Column grid template — responsive, shared between header and rows
type BreakpointKey = 'base' | 'sm' | 'md' | 'lg'
type VisibleCol = 'drag' | 'asset' | 'price' | 'change1d' | 'change1w' | 'high52w' | 'ytd' | 'trend' | 'rs_momentum' | 'remove'

const BREAKPOINT_COLS: Record<BreakpointKey, { grid: string; cols: Set<VisibleCol> }> = {
  base: { grid: '1fr 62px 54px 66px',                                          cols: new Set(['asset', 'price', 'change1d', 'rs_momentum']) },
  sm:   { grid: '1fr 66px 58px 58px 70px 22px',                                cols: new Set(['asset', 'price', 'change1d', 'change1w', 'rs_momentum', 'remove']) },
  md:   { grid: '120px 68px 58px 58px 66px 58px 54px 72px 22px',               cols: new Set(['asset', 'price', 'change1d', 'change1w', 'high52w', 'ytd', 'trend', 'rs_momentum', 'remove']) },
  lg:   { grid: '20px 140px 72px 64px 64px 72px 64px 56px 80px 24px',          cols: new Set(['drag', 'asset', 'price', 'change1d', 'change1w', 'high52w', 'ytd', 'trend', 'rs_momentum', 'remove']) },
}

function useBreakpoint(): BreakpointKey {
  const lg = useMediaQuery('(min-width: 1024px)')
  const md = useMediaQuery('(min-width: 768px)')
  const sm = useMediaQuery('(min-width: 640px)')
  if (lg) return 'lg'
  if (md) return 'md'
  if (sm) return 'sm'
  return 'base'
}

type SortCol = 'ticker' | 'price' | 'change1d' | 'change1w' | 'high52w' | 'ytd' | 'rs_momentum'

// ─── SortableHeader ───────────────────────────────────────────────────────────
function SortableHeader({
  label, col, current, asc, onSort, visible = true,
}: {
  label: string; col: SortCol | null; current: SortCol; asc: boolean; onSort: (c: SortCol) => void; visible?: boolean
}) {
  if (!visible) return null
  if (!col) return <span className="text-[9px] text-zinc-700 uppercase tracking-wider font-medium">{label}</span>
  const active = current === col
  return (
    <button
      onClick={() => onSort(col)}
      className={`text-[9px] uppercase tracking-wider font-medium flex items-center gap-1 transition-all whitespace-nowrap
        ${active
          ? 'text-blue-300 bg-blue-600/20 border border-blue-500/50 rounded-full px-2 py-0.5'
          : 'text-zinc-600 hover:text-zinc-400 px-0 py-0.5'
        }`}
    >
      {label}
      {active
        ? <ChevronDown size={10} strokeWidth={2.5} className={`transition-transform ${asc ? 'rotate-180' : ''}`} />
        : <ChevronsUpDown size={9} className="opacity-40" />
      }
    </button>
  )
}

// ─── SectionHeader ────────────────────────────────────────────────────────────
function SectionHeader({
  name, count, collapsed, onToggle, onAdd,
}: {
  name: SectionName; count: number; collapsed: boolean
  onToggle: () => void
  onAdd: (symbols: string[], section: SectionName) => void
}) {
  const [adding, setAdding] = useState(false)
  const [input,  setInput]  = useState('')

  const submit = () => {
    const symbols = input.split(/[\s,]+/).map(s => s.trim().toUpperCase()).filter(Boolean)
    if (symbols.length) onAdd(symbols, name)
    setInput(''); setAdding(false)
  }

  return (
    <div className="flex items-center px-3 py-1.5 bg-[#0C0C0C] border-y border-white/[0.04] sticky top-[37px] z-[9] group/hdr">
      <button
        onClick={onToggle}
        className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest text-zinc-600 hover:text-zinc-400 transition-colors"
      >
        <ChevronDown size={10} strokeWidth={2.5} className={`transition-transform duration-150 ${collapsed ? '-rotate-90' : ''}`} />
        <span className="font-semibold">{name}</span>
        <span className="text-zinc-700 tabular-nums">({count})</span>
      </button>
      <div className="flex-1" />
      {adding ? (
        <div className="flex items-center gap-1">
          <input
            autoFocus value={input}
            onChange={e => setInput(e.target.value.toUpperCase())}
            onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') { setAdding(false); setInput('') } }}
            placeholder="SPY, QQQ…"
            className="w-28 bg-[#111] text-white text-[10px] px-2 py-0.5 rounded border border-[#3B82F6] focus:outline-none placeholder-[#333]"
          />
          <button onClick={submit} className="text-[#3B82F6] hover:text-white transition-colors"><Plus size={12} /></button>
          <button onClick={() => { setAdding(false); setInput('') }} className="text-zinc-600 hover:text-white text-sm leading-none">×</button>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="opacity-0 group-hover/hdr:opacity-100 lg:opacity-0 lg:group-hover/hdr:opacity-100 transition-opacity text-zinc-600 hover:text-[#3B82F6]"
        >
          <Plus size={11} />
        </button>
      )}
    </div>
  )
}

function RSHistogram({ values, slope5d }: { values: number[]; slope5d: number }) {
  const min   = Math.min(...values)
  const max   = Math.max(...values)
  const range = max - min || 1
  const isPos = slope5d > 0
  return (
    <div className="flex items-end gap-px flex-shrink-0" style={{ width: 75, height: 22 }}>
      {values.map((v, i) => {
        const pct     = Math.max(8, ((v - min) / range) * 100)
        const opacity = 0.5 + (i / values.length) * 0.5
        return (
          <div
            key={i}
            className={`flex-1 rounded-sm ${isPos ? 'bg-emerald-400' : 'bg-rose-500'}`}
            style={{ height: `${pct}%`, opacity }}
          />
        )
      })}
    </div>
  )
}

// ─── StrengthBar — colored underbar representing move magnitude ───────────────
function StrengthBar({ pct, max = 10 }: { pct: number; max?: number }) {
  const width = Math.min(100, (Math.abs(pct) / max) * 100)
  const color = pct >= 0 ? '#34d399' : '#f43f5e'
  return (
    <div className="w-full h-[3px] bg-white/[0.04] rounded-full mt-1 overflow-hidden">
      <div style={{ width: `${width}%`, backgroundColor: color }} className="h-full rounded-full" />
    </div>
  )
}

// ─── PriceSparkline — 5D close price trend line ───────────────────────────────
function PriceSparkline({ candles }: { candles: Candle[] }) {
  const slice = candles.slice(-6)
  if (slice.length < 2) return <div style={{ width: 52, height: 20 }} />
  const closes = slice.map(c => c.close)
  const isUp   = closes[closes.length - 1] >= closes[0]
  const color  = isUp ? '#34d399' : '#f43f5e'
  const min    = Math.min(...closes)
  const max    = Math.max(...closes)
  const range  = max - min || 0.0001
  const W = 52, H = 20
  const pts = closes
    .map((v, i) => `${(i / (closes.length - 1)) * W},${H - ((v - min) / range) * (H - 6) - 3}`)
    .join(' ')
  return (
    <svg width={W} height={H} className="overflow-visible flex-shrink-0">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5}
        strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

// ─── CursorChart — fixed portal chart that follows the mouse cursor ───────────
function CursorChart({ row, cursor }: { row: RSRow; cursor: { x: number; y: number } }) {
  // Clamp so popup never overflows right or bottom edge
  const W = 264, H = 210
  const left = Math.min(cursor.x + 16, window.innerWidth  - W - 8)
  const top  = Math.min(cursor.y - 80,  window.innerHeight - H - 8)

  return createPortal(
    <AnimatePresence>
      <motion.div
        key={row.ticker}
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.12 }}
        className="fixed z-[999] pointer-events-none rounded-xl border border-[#2A2A2A] bg-[#0D0D0D] shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden"
        style={{ left, top, width: W }}
      >
        <div className="px-3 py-2 border-b border-[#1A1A1A] flex items-center gap-2">
          <span className="text-white text-[11px] font-bold tracking-wide">{row.ticker}</span>
          <span className="text-zinc-600 text-[9px] truncate flex-1 min-w-0">{row.name}</span>
          <span className="text-zinc-700 text-[8px] font-mono flex-shrink-0">3mo</span>
        </div>
        <CandleChart candles={row.candles} height={140} />
        <div className="px-3 py-1.5 border-t border-[#1A1A1A] flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="text-[8px] text-zinc-700 uppercase tracking-wider">RS</span>
            <span className={`text-[10px] font-mono font-medium tabular-nums ${row.rs_strength >= 100 ? 'text-emerald-400' : 'text-zinc-500'}`}>
              {row.rs_strength.toFixed(1)}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[8px] text-zinc-700 uppercase tracking-wider">Mom</span>
            <span className={`text-[10px] font-mono font-medium tabular-nums ${row.rs_momentum >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
              {row.rs_momentum >= 0 ? '+' : ''}{row.rs_momentum.toFixed(2)}%
            </span>
          </div>
          <div className="flex items-center gap-1 ml-auto">
            <span className="text-[8px] text-zinc-700 uppercase tracking-wider">Rank</span>
            <span className="text-[10px] font-mono text-zinc-400 font-medium">#{row.rank}</span>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  )
}

// ─── TickerRow ────────────────────────────────────────────────────────────────
function TickerRow({
  row,
  isSelected,
  sortActive,
  visibleCols,
  gridCols,
  isTouch,
  onSelect,
  onRemove,
  onHover,
  onCursorMove,
}: {
  row:          RSRow
  isSelected:   boolean
  sortActive:   boolean
  visibleCols:  Set<VisibleCol>
  gridCols:     string
  isTouch:      boolean
  onSelect:     (t: string) => void
  onRemove:     (t: string) => void
  onHover:      (row: RSRow | null) => void
  onCursorMove: (pos: { x: number; y: number } | null) => void
}) {
  const dragControls = useDragControls()
  const [expanded, setExpanded] = useState(false)
  const { candles } = row

  const change1d = candles.length >= 2
    ? ((candles.at(-1)!.close - candles.at(-2)!.close) / candles.at(-2)!.close) * 100
    : null
  const change1w = candles.length >= 6
    ? ((candles.at(-1)!.close - candles.at(-6)!.close) / candles.at(-6)!.close) * 100
    : null
  const high52w  = candles.length > 0 ? Math.max(...candles.map(c => c.high)) : row.price
  const fromHigh = ((row.price - high52w) / high52w) * 100
  const currentYear = new Date().getFullYear()
  const ytdStart = candles.find(c => c.time.startsWith(`${currentYear}-`))
  const ytd = ytdStart ? ((row.price - ytdStart.open) / ytdStart.open) * 100 : null

  const fmt = (v: number | null) =>
    v === null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`
  const pctColor = (v: number | null) =>
    v === null ? 'text-zinc-600' : v >= 0 ? 'text-emerald-400' : 'text-rose-500'

  const handleClick = () => {
    if (isTouch) setExpanded(prev => !prev)
    onSelect(row.ticker)
  }

  return (
    <Reorder.Item
      value={row}
      dragListener={false}
      dragControls={dragControls}
      className="select-none group"
    >
      <div
        className={[
          'grid items-center px-3 py-[7px] border-b border-white/[0.03] cursor-pointer',
          'hover:bg-white/[0.03] transition-all duration-100',
          isSelected
            ? 'bg-blue-500/[0.06] border-l-2 border-l-blue-500 shadow-[inset_0_0_20px_rgba(59,130,246,0.05)]'
            : 'border-l-2 border-l-transparent',
        ].join(' ')}
        style={{ gridTemplateColumns: gridCols }}
        onClick={handleClick}
        onMouseEnter={() => { if (!isTouch) onHover(row) }}
        onMouseMove={e => { if (!isTouch) onCursorMove({ x: e.clientX, y: e.clientY }) }}
        onMouseLeave={() => { if (!isTouch) { onHover(null); onCursorMove(null) } }}
      >
        {/* Drag handle — hidden when sort is active or below lg */}
        {visibleCols.has('drag') && (
          <div
            className={`flex items-center justify-center cursor-grab active:cursor-grabbing transition-opacity
              ${sortActive ? 'opacity-0 pointer-events-none' : 'opacity-0 group-hover:opacity-60'}`}
            onPointerDown={e => { e.preventDefault(); dragControls.start(e) }}
          >
            <GripVertical size={11} className="text-zinc-600" />
          </div>
        )}

        {/* Asset */}
        <div className="min-w-0 pr-2">
          <div className="text-white text-[11px] font-bold tracking-wide leading-tight">{row.ticker}</div>
          {visibleCols.has('drag') && (
            <div className="text-zinc-600 text-[9px] truncate leading-tight mt-0.5">{row.name}</div>
          )}
        </div>

        {/* Price */}
        <div className="font-mono text-[11px] text-zinc-200 tabular-nums">${row.price.toFixed(2)}</div>

        {/* 1D% */}
        <div className="pr-1">
          <div className={`font-mono text-[10px] tabular-nums leading-none ${pctColor(change1d)}`}>{fmt(change1d)}</div>
          <StrengthBar pct={change1d ?? 0} max={5} />
        </div>

        {/* 1W% */}
        {visibleCols.has('change1w') && (
          <div className="pr-1">
            <div className={`font-mono text-[10px] tabular-nums leading-none ${pctColor(change1w)}`}>{fmt(change1w)}</div>
            <StrengthBar pct={change1w ?? 0} max={10} />
          </div>
        )}

        {/* 52W HI% */}
        {visibleCols.has('high52w') && (
          <div className="pr-1">
            <div className={`font-mono text-[10px] tabular-nums leading-none ${pctColor(fromHigh)}`}>{fmt(fromHigh)}</div>
            <StrengthBar pct={fromHigh} max={20} />
          </div>
        )}

        {/* YTD% */}
        {visibleCols.has('ytd') && (
          <div className="pr-1">
            <div className={`font-mono text-[10px] tabular-nums leading-none ${pctColor(ytd)}`}>{fmt(ytd)}</div>
            <StrengthBar pct={ytd ?? 0} max={30} />
          </div>
        )}

        {/* 5D Sparkline */}
        {visibleCols.has('trend') && <PriceSparkline candles={candles} />}

        {/* RS Momentum histogram */}
        <RSHistogram values={row.rs_norm} slope5d={row.slope_5d} />

        {/* Remove */}
        {visibleCols.has('remove') && (
          <button
            onClick={e => { e.stopPropagation(); onRemove(row.ticker) }}
            className="text-zinc-700 hover:text-rose-500 transition-colors text-sm leading-none opacity-0 group-hover:opacity-100"
          >×</button>
        )}
      </div>

      {/* Tap-to-expand detail panel (touch devices) */}
      <AnimatePresence>
        {expanded && isTouch && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-b border-white/[0.03] bg-white/[0.02]"
          >
            <div className="px-3 py-2">
              <CandleChart candles={candles} height={120} />
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-[10px]">
                <div className="flex justify-between">
                  <span className="text-zinc-600">1W%</span>
                  <span className={`font-mono tabular-nums ${pctColor(change1w)}`}>{fmt(change1w)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-600">52W HI%</span>
                  <span className={`font-mono tabular-nums ${pctColor(fromHigh)}`}>{fmt(fromHigh)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-600">YTD%</span>
                  <span className={`font-mono tabular-nums ${pctColor(ytd)}`}>{fmt(ytd)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-600">RS Mom</span>
                  <span className={`font-mono tabular-nums ${row.rs_momentum >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                    {row.rs_momentum >= 0 ? '+' : ''}{row.rs_momentum.toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-600">RS Strength</span>
                  <span className={`font-mono tabular-nums ${row.rs_strength >= 100 ? 'text-emerald-400' : 'text-zinc-400'}`}>
                    {row.rs_strength.toFixed(1)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-600">Rank</span>
                  <span className="font-mono tabular-nums text-zinc-400">#{row.rank}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={e => { e.stopPropagation(); onSelect(row.ticker) }}
                  className="text-[9px] text-blue-400 border border-blue-500/30 rounded px-2 py-1 hover:bg-blue-500/10 transition-colors"
                >
                  View Holdings
                </button>
                <button
                  onClick={e => { e.stopPropagation(); onRemove(row.ticker) }}
                  className="text-[9px] text-rose-400 border border-rose-500/30 rounded px-2 py-1 hover:bg-rose-500/10 transition-colors"
                >
                  Remove
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Reorder.Item>
  )
}



// ─── RRGChart ─────────────────────────────────────────────────────────────────
function RRGChart({ data, onSelect }: { data: RSRow[]; onSelect: (ticker: string) => void }) {
  const [hovered, setHovered] = useState<string | null>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const isTouch = useIsTouchDevice()

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
      <svg ref={svgRef} width="100%" viewBox={`0 0 ${W} ${H}`} className="overflow-visible"
        onMouseLeave={() => { if (!isTouch) { setHovered(null); setTooltip(null) } }}
        onClick={e => { if (isTouch && e.target === svgRef.current) { setHovered(null); setTooltip(null) } }}>
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
        <text x={pad+4}   y={pad+14}    fill="#FACC15" fontSize={10} opacity={0.7} fontWeight="600">▲ Improving</text>
        <text x={pad+4}   y={H-pad-6}   fill="#F87171" fontSize={10} opacity={0.7} fontWeight="600">▼ Lagging</text>
        <text x={W-pad-4} y={H-pad-6}   fill="#60A5FA" fontSize={10} textAnchor="end" opacity={0.7} fontWeight="600">Weakening ▼</text>
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
              onMouseEnter={e => { if (!isTouch) { setHovered(row.ticker); setTooltip({ x: e.clientX, y: e.clientY }) } }}
              onMouseMove={e  => { if (!isTouch) setTooltip({ x: e.clientX, y: e.clientY }) }}
              onClick={() => {
                if (isTouch) {
                  // Toggle tooltip on tap; second tap on same dot → drill down
                  if (hovered === row.ticker) { onSelect(row.ticker); setHovered(null); setTooltip(null) }
                  else {
                    const rect = svgRef.current?.getBoundingClientRect()
                    if (rect) setTooltip({ x: rect.left + (toX(row.rs_strength) / W) * rect.width, y: rect.top + (toY(row.rs_momentum) / H) * rect.height })
                    setHovered(row.ticker)
                  }
                } else {
                  onSelect(row.ticker)
                }
              }}
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
             : hoveredRow.rs_strength >= 100 ? '● Weakening'
             : hoveredRow.rs_momentum >= 0   ? '● Improving'
             : '● Lagging'}
          </div>
          <div className="text-[9px] text-[#444] mt-0.5">Click to drill into holdings</div>
        </div>
      )}
    </div>
  )
}

// ─── Audit types ─────────────────────────────────────────────────────────────
interface AuditTheme {
  theme:             string
  covered:           boolean
  covered_by?:       string
  suggested_ticker?: string
  suggested_name?:   string
  why_now?:          string
}

// ─── Toast ───────────────────────────────────────────────────────────────────
function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000)
    return () => clearTimeout(t)
  }, [onDone])
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      className="fixed bottom-14 right-4 left-4 sm:left-auto sm:right-6 sm:bottom-6 z-50 bg-[#141414] border border-white/[0.08] text-white text-[11px] px-4 py-3 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-sm text-center sm:text-left"
    >
      {message}
    </motion.div>
  )
}

// ─── AuditModal ───────────────────────────────────────────────────────────────
function AuditModal({
  tickers,
  trackedTickers,
  onClose,
  onAdd,
}: {
  tickers:        string[]
  trackedTickers: string[]
  onClose:        () => void
  onAdd:          (ticker: string) => void
}) {
  const [loading, setLoading] = useState(true)
  const [result,  setResult]  = useState<AuditTheme[] | null>(null)
  const [error,   setError]   = useState<string | null>(null)
  const [added,   setAdded]   = useState<Set<string>>(new Set())

  useEffect(() => {
    const run = async () => {
      setLoading(true); setError(null)
      try {
        const prompt = `I track the following ETFs in my market dashboard: ${tickers.join(', ')}.

Analyze my coverage and return ONLY a valid JSON object (no markdown, no extra text) with this exact structure:
{
  "themes": [
    { "theme": "US Technology", "covered": true, "covered_by": "XLK" },
    {
      "theme": "Nuclear Energy",
      "covered": false,
      "suggested_ticker": "URNM",
      "suggested_name": "Sprott Uranium Miners ETF",
      "why_now": "Brief reason why this theme is relevant right now"
    }
  ]
}

Rules:
- Map each of my current ETFs to the theme(s) it covers (covered=true rows)
- Identify 6-10 important themes NOT covered by my current list (covered=false rows)
- Use web_search to check current market narratives for the why_now field
- suggested_ticker must be a real, liquid US-listed ETF
- Return only the JSON object, nothing else`

        const claudeBase = (import.meta.env.VITE_API_URL as string) || '/api'
        const res = await fetch(`${claudeBase}/claude`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            model:      'claude-opus-4-6',
            max_tokens: 4096,
            tools:      [{ type: 'web_search_20250305', name: 'web_search' }],
            messages:   [{ role: 'user', content: prompt }],
          }),
        })

        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error((err as { error?: { message?: string } }).error?.message ?? `API error ${res.status}`)
        }

        const data = await res.json() as { content?: { type: string; text?: string }[] }
        const textBlock = data.content?.find(b => b.type === 'text')
        if (!textBlock?.text) throw new Error('No text response from Claude')

        const jsonStr = textBlock.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
        const parsed = JSON.parse(jsonStr) as { themes: AuditTheme[] }
        setResult(parsed.themes)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Audit failed')
      } finally {
        setLoading(false)
      }
    }
    void run()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const uncovered = result?.filter(t => !t.covered) ?? []
  const covered   = result?.filter(t => t.covered)  ?? []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.15 }}
        className="bg-[#0F0F0F] border border-[#1E1E1E] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-5 py-4 border-b border-[#1A1A1A] flex-shrink-0">
          <Sparkles size={15} className="text-purple-400" />
          <span className="text-white font-semibold text-sm">Coverage Audit</span>
          <span className="text-zinc-600 text-[11px]">— powered by Claude</span>
          <div className="flex-1" />
          <button onClick={onClose} className="text-zinc-600 hover:text-white transition-colors text-xl leading-none">×</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <RefreshCw size={20} className="animate-spin text-purple-400" />
              <span className="text-zinc-500 text-sm">Claude is auditing your coverage…</span>
              <span className="text-zinc-700 text-[11px]">Searching current market conditions</span>
            </div>
          )}

          {error && (
            <div className="text-center py-10">
              <p className="text-[#F87171] text-sm mb-2">{error}</p>
              <p className="text-zinc-600 text-[11px]">Check that VITE_ANTHROPIC_API_KEY is set in your .env file</p>
            </div>
          )}

          {result && (
            <div className="space-y-6">
              {/* Uncovered themes */}
              {uncovered.length > 0 && (
                <div>
                  <div className="text-[10px] text-zinc-600 uppercase tracking-wider mb-3 font-medium">
                    Coverage Gaps ({uncovered.length})
                  </div>
                  <div className="space-y-2">
                    {uncovered.map(t => (
                      <div key={t.theme} className="bg-[#171717] border border-orange-500/20 rounded-xl p-4 flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-[9px] font-mono bg-orange-500/15 text-orange-400 border border-orange-500/30 px-1.5 py-0.5 rounded uppercase tracking-wider">
                              Not Covered
                            </span>
                            <span className="text-white text-[13px] font-medium">{t.theme}</span>
                          </div>
                          {t.suggested_ticker && (
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-zinc-200 font-mono text-xs font-bold">{t.suggested_ticker}</span>
                              <span className="text-zinc-600 text-[11px]">{t.suggested_name}</span>
                            </div>
                          )}
                          {t.why_now && (
                            <p className="text-zinc-500 text-[11px] mt-1.5 leading-relaxed">{t.why_now}</p>
                          )}
                        </div>
                        {t.suggested_ticker && (
                          <button
                            onClick={() => {
                              onAdd(t.suggested_ticker!)
                              setAdded(prev => new Set([...prev, t.suggested_ticker!]))
                            }}
                            disabled={added.has(t.suggested_ticker) || trackedTickers.includes(t.suggested_ticker)}
                            className={[
                              'flex-shrink-0 text-[11px] font-medium px-3 py-1.5 rounded-lg transition-all border',
                              added.has(t.suggested_ticker) || trackedTickers.includes(t.suggested_ticker)
                                ? 'bg-green-500/20 text-green-400 border-green-500/30 cursor-default'
                                : 'bg-[#3B82F6]/10 text-[#3B82F6] border-[#3B82F6]/30 hover:bg-[#3B82F6]/20',
                            ].join(' ')}
                          >
                            {added.has(t.suggested_ticker) || trackedTickers.includes(t.suggested_ticker) ? '✓ Added' : '+ Add'}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Covered themes */}
              {covered.length > 0 && (
                <div>
                  <div className="text-[10px] text-zinc-600 uppercase tracking-wider mb-3 font-medium">
                    Already Covered ({covered.length})
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {covered.map(t => (
                      <div key={t.theme} className="bg-[#111] border border-[#1A1A1A] rounded-lg px-3 py-2 flex items-center gap-2">
                        <span className="text-[9px] font-mono bg-green-500/15 text-green-400 border border-green-500/30 px-1.5 py-0.5 rounded flex-shrink-0">
                          {t.covered_by}
                        </span>
                        <span className="text-zinc-400 text-[11px] truncate">{t.theme}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {result && (
          <div className="flex-shrink-0 px-5 py-3 border-t border-[#1A1A1A] flex items-center justify-between">
            <span className="text-zinc-700 text-[10px]">
              {uncovered.length} gaps · {covered.length} covered · {added.size} added this session
            </span>
            <button
              onClick={onClose}
              className="text-zinc-400 hover:text-white text-[11px] px-3 py-1.5 rounded border border-[#1E1E1E] hover:border-[#333] transition-all"
            >
              Done
            </button>
          </div>
        )}
      </motion.div>
    </div>
  )
}

// ─── AI Market Summary ───────────────────────────────────────────────────────
interface Callout {
  type:   'STRONG' | 'WEAK' | 'WATCH' | 'RISK' | 'IMPROVING'
  label:  string
  reason: string
}

interface SummaryCache {
  paragraph:     string
  callouts:      Callout[]
  generatedAt:   string
  generatedTime: string
}

const SUMMARY_CACHE_KEY   = 'jmn_ai_summary'
const COLLAPSED_CACHE_KEY = 'jmn_ai_summary_collapsed'

const CALLOUT_CONFIG: Record<Callout['type'], { icon: string; border: string; bg: string; label_color: string }> = {
  STRONG:    { icon: '🟢', bg: 'bg-green-500/10',  border: 'border-green-500/25',  label_color: 'text-green-300'  },
  WEAK:      { icon: '🔴', bg: 'bg-red-500/10',    border: 'border-red-500/25',    label_color: 'text-red-300'    },
  WATCH:     { icon: '👀', bg: 'bg-blue-500/10',   border: 'border-blue-500/25',   label_color: 'text-blue-300'   },
  RISK:      { icon: '⚠️', bg: 'bg-amber-500/10',  border: 'border-amber-500/25',  label_color: 'text-amber-300'  },
  IMPROVING: { icon: '📈', bg: 'bg-indigo-500/10', border: 'border-indigo-500/25', label_color: 'text-indigo-300' },
}

// Inline ticker badge — clickable, highlights corresponding card
function TickerBadge({ ticker, onClick }: { ticker: string; onClick: () => void }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick() }}
      className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-500/15 border border-blue-500/25 text-blue-300 font-mono text-[10px] hover:bg-blue-500/30 transition-colors mx-0.5 align-middle leading-none"
    >
      {ticker}
    </button>
  )
}

// Parse paragraph text and replace known tickers with TickerBadge components
function parseWithBadges(text: string, tickers: string[], onSelect: (t: string) => void) {
  if (!tickers.length) return [text]
  const escaped = tickers.map(t => t.replace(/[.+]/g, '\\$&'))
  const pattern = new RegExp(`\\b(${escaped.join('|')})\\b`, 'g')
  const nodes: (string | ReactNode)[] = []
  let last = 0; let m: RegExpExecArray | null
  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index))
    const t = m[1]
    nodes.push(<TickerBadge key={`${t}-${m.index}`} ticker={t} onClick={() => onSelect(t)} />)
    last = m.index + t.length
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

// Horizontal sentiment gauge (Bearish ←→ Bullish)
function SentimentGauge({ data }: { data: RSRow[] }) {
  const avg  = data.length ? data.reduce((s, r) => s + r.rs_momentum, 0) / data.length : 0
  const pct  = Math.min(100, Math.max(0, (avg + 15) / 30 * 100))
  const color = pct >= 58 ? '#4ADE80' : pct <= 42 ? '#F87171' : '#FACC15'
  const label = pct >= 58 ? 'Bullish' : pct <= 42 ? 'Bearish' : 'Neutral'
  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] text-zinc-700 w-10 text-right flex-shrink-0 uppercase tracking-wider">Bear</span>
      <div className="relative flex-1 h-1 bg-[#1E1E1E] rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        />
        <div className="absolute top-0 left-1/2 h-full w-px bg-[#333]" />
      </div>
      <span className="text-[9px] text-zinc-700 w-10 flex-shrink-0 uppercase tracking-wider">Bull</span>
      <span className="text-[9px] font-semibold w-10 flex-shrink-0 tabular-nums" style={{ color }}>{label}</span>
    </div>
  )
}

// Creator Mode — Instagram Reel script overlay
function CreatorModeOverlay({ result, onClose }: { result: SummaryCache; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const strong = result.callouts.find(c => c.type === 'STRONG')
  const weak   = result.callouts.find(c => c.type === 'WEAK')
  const risk   = result.callouts.find(c => c.type === 'RISK')

  const hook  = strong ? `🚨 Institutions are rotating INTO ${strong.label} right now.` : `🚨 Major market rotation is happening right now.`
  const warns = [weak && `⚠️ Avoid ${weak.label} — ${weak.reason}`, risk && `🔴 Risk: ${risk.reason}`].filter(Boolean).join('\n')
  const cta   = `\n📊 Follow @jeromefong for daily RS rotation analysis.\n#StockMarket #ETF #SwingTrading #Momentum`
  const full  = `${hook}\n\n${result.paragraph}\n\n${warns}\n${cta}`

  const handleCopy = () => {
    navigator.clipboard.writeText(full).catch(() => {})
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="bg-[#0F0F0F] border border-[#2A2A2A] rounded-2xl w-full max-w-md shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-5 py-4 border-b border-[#1A1A1A]">
          <span>📱</span>
          <span className="text-white font-semibold text-sm">Instagram Reel Script</span>
          <span className="text-zinc-600 text-[10px] ml-0.5">@ jeromefong</span>
          <div className="flex-1" />
          <button onClick={onClose} className="text-zinc-600 hover:text-white text-xl leading-none">×</button>
        </div>
        <div className="px-5 py-4 space-y-4">
          {[
            { key: 'Hook',     text: hook,              cls: 'text-orange-300 font-semibold' },
            { key: 'Body',     text: result.paragraph,  cls: 'text-zinc-300' },
            { key: 'Warnings', text: warns,             cls: 'text-zinc-400' },
            { key: 'CTA',      text: cta,               cls: 'text-blue-400' },
          ].filter(s => s.text).map(s => (
            <div key={s.key}>
              <span className="text-[9px] text-zinc-600 uppercase tracking-widest font-medium">{s.key}</span>
              <p className={`text-[11px] mt-1.5 leading-relaxed whitespace-pre-line ${s.cls}`}>{s.text}</p>
            </div>
          ))}
        </div>
        <div className="px-5 pb-4">
          <button
            onClick={handleCopy}
            className={`w-full py-2.5 rounded-xl text-[12px] font-medium transition-all border ${
              copied ? 'bg-green-500/20 border-green-500/30 text-green-300' : 'bg-[#1A1A1A] border-[#2A2A2A] text-white hover:bg-[#222]'
            }`}
          >
            {copied ? '✓ Copied to clipboard' : '📋 Copy full script'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function AIMarketSummary({ data, onSelectTicker }: { data: RSRow[]; onSelectTicker: (t: string) => void }) {
  const [collapsed,    setCollapsedState] = useState<boolean>(() => {
    try { return localStorage.getItem(COLLAPSED_CACHE_KEY) === 'true' } catch { return false }
  })
  const [loading,      setLoading]     = useState(false)
  const [error,        setError]       = useState<string | null>(null)
  const [result,       setResult]      = useState<SummaryCache | null>(() => {
    try {
      const raw = localStorage.getItem(SUMMARY_CACHE_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw) as SummaryCache
      return parsed.generatedAt === new Date().toISOString().split('T')[0] ? parsed : null
    } catch { return null }
  })
  const [creatorMode,  setCreatorMode] = useState(false)
  const hasFetched = useRef(false)

  const setCollapsed = (v: boolean) => {
    setCollapsedState(v)
    try { localStorage.setItem(COLLAPSED_CACHE_KEY, String(v)) } catch { /* ignore */ }
  }

  const callApi = async (rows: RSRow[], force = false) => {
    // Always check cache first — skip API call if today's summary already exists
    if (!force) {
      try {
        const raw = localStorage.getItem(SUMMARY_CACHE_KEY)
        if (raw) {
          const cached = JSON.parse(raw) as SummaryCache
          const today  = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD local time
          if (cached.generatedAt === today) {
            setResult(cached)
            return
          }
        }
      } catch { /* proceed to API */ }
    }

    setLoading(true); setError(null)
    try {
      const sorted = [...rows].sort((a, b) => b.rs_momentum - a.rs_momentum)
      const today  = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

      const fmt = (row: RSRow) => {
        const wk = row.candles.length >= 6
          ? ((row.candles.at(-1)!.close - row.candles.at(-6)!.close) / row.candles.at(-6)!.close * 100).toFixed(2)
          : 'N/A'
        const quadrant =
          row.rs_strength >= 100 && row.rs_momentum >= 0 ? 'Leading' :
          row.rs_strength <  100 && row.rs_momentum >= 0 ? 'Improving' :
          row.rs_strength >= 100 && row.rs_momentum <  0 ? 'Weakening' : 'Lagging'
        return `${row.ticker} (${row.name}) | RS Slope: ${row.rs_slope.toFixed(4)} | Momentum: ${row.rs_momentum.toFixed(2)} | 1W: ${wk}% | RRG: ${quadrant}`
      }

      // All tickers sorted by momentum, with RRG quadrant labels
      const allFormatted  = sorted.map(fmt).join('\n')
      const improving     = sorted.filter(r => r.rs_strength < 100 && r.rs_momentum >= 0)
      const improvingFmt  = improving.length ? improving.map(fmt).join('\n') : 'None currently'

      const userPrompt = `Today is ${today}.

FULL ETF RS LEADERBOARD (sorted by momentum, strongest first):
${allFormatted}

IMPROVING QUADRANT (rising momentum, not yet leading — early rotation signals):
${improvingFmt}

Using this RS data as your primary source, plus a web search for current macro context, write a market summary covering:
- Where institutional money is rotating INTO (cite specific ETFs)
- Where money is rotating OUT OF (cite specific ETFs)
- Which ETFs are in the IMPROVING quadrant and WHY — what macro story or catalyst is driving their recovery
- One key macro risk or catalyst explaining the current rotation

Format your response as JSON only. No preamble, no markdown fences.
{
  "paragraph": "4-6 sentence cohesive summary. Must mention improving-quadrant ETFs by ticker and explain the story behind their rotation.",
  "callouts": [
    { "type": "STRONG",    "label": "theme name", "reason": "one line" },
    { "type": "IMPROVING", "label": "ETF ticker + theme", "reason": "what catalyst is driving the recovery" },
    { "type": "WEAK",      "label": "theme name", "reason": "one line" },
    { "type": "RISK",      "label": "macro factor", "reason": "one line" }
  ]
}
Be specific. Reference actual tickers and RS values. Do not repeat the same idea in the paragraph and callouts.`

      const claudeBase = (import.meta.env.VITE_API_URL as string) || '/api'
      const res = await fetch(`${claudeBase}/claude`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model:      'claude-haiku-4-5-20251001',
          max_tokens: 1200,
          system:     'You are a professional market analyst. Respond ONLY with the requested JSON object — no preamble, no explanation, no markdown fences. Your entire response must start with { and end with }.',
          tools:      [{ type: 'web_search_20250305', name: 'web_search' }],
          messages:   [{ role: 'user', content: userPrompt }],
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: { message?: string } }).error?.message ?? `API error ${res.status}`)
      }

      const body      = await res.json() as { content?: { type: string; text?: string }[] }
      const textBlock = body.content?.find(b => b.type === 'text')
      if (!textBlock?.text) throw new Error('No text in API response')

      // Extract the JSON object — Claude sometimes prepends conversational text before/after the JSON
      const raw     = textBlock.text.replace(/<[^>]*>/g, '') // strip <cite> and other HTML tags
      const jsonStr = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)
      if (!jsonStr) throw new Error('No JSON object found in response')
      const parsed  = JSON.parse(jsonStr) as { paragraph: string; callouts: Callout[] }
      parsed.paragraph = parsed.paragraph.replace(/<[^>]*>/g, '')
      const cache: SummaryCache = {
        ...parsed,
        generatedAt:   new Date().toISOString().split('T')[0],
        generatedTime: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      }
      try { localStorage.setItem(SUMMARY_CACHE_KEY, JSON.stringify(cache)) } catch { /* ignore */ }
      setResult(cache)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate summary')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (data.length === 0 || hasFetched.current) return
    hasFetched.current = true
    if (result) return
    void callApi(data)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.length])

  if (data.length === 0) return null

  // Sentiment border color based on top-5 RS slopes
  const sortedBySlope     = [...data].sort((a, b) => b.rs_slope - a.rs_slope)
  const top5Positive      = sortedBySlope.slice(0, 5).filter(r => r.rs_slope > 0).length >= 3
  const glowColor         = top5Positive ? 'rgba(74,222,128,0.4)' : 'rgba(248,113,113,0.4)'
  // Source chips: top 3 by absolute RS slope influence
  const sourceChips       = [...data].sort((a, b) => Math.abs(b.rs_slope) - Math.abs(a.rs_slope)).slice(0, 3)
  const knownTickers      = data.map(r => r.ticker)

  return (
    <>
      <AnimatePresence>
        {creatorMode && result && (
          <CreatorModeOverlay result={result} onClose={() => setCreatorMode(false)} />
        )}
      </AnimatePresence>

      <div
        className="flex-shrink-0 bg-white/[0.025] backdrop-blur-md border-b"
        style={{ borderColor: 'rgba(255,255,255,0.06)', boxShadow: `0 1px 0 0 ${glowColor}` }}
      >
        {/* ── Header ── */}
        <div className="flex items-center gap-2 px-4 py-2.5">
          {/* Live pulsing dot */}
          <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
          </span>
          <span className="text-white text-[11px] font-semibold tracking-wide">AI Market Summary</span>
          <span className="text-zinc-700 text-[9px] border border-white/[0.06] px-1.5 py-0.5 rounded font-mono">Powered by Claude</span>
          <div className="flex-1" />
          {result && (
            <button onClick={() => setCreatorMode(true)} title="Instagram Reel Script" className="text-zinc-600 hover:text-purple-400 transition-colors">
              <Wand2 size={12} />
            </button>
          )}
          <button onClick={() => void callApi(data)} disabled={loading} title="Force refresh" className="text-[#444] hover:text-white transition-colors disabled:opacity-30 ml-1">
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => setCollapsed(!collapsed)} className="text-[#444] hover:text-white transition-colors ml-1">
            {collapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
          </button>
        </div>

        {/* ── Body (animated expand/collapse) ── */}
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              key="body"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-3 space-y-3">
                {/* Sentiment gauge */}
                <SentimentGauge data={data} />

                {/* Skeleton on first load */}
                {loading && !result && (
                  <div className="space-y-2 py-1">
                    <div className="h-2.5 rounded w-full shimmer-line" />
                    <div className="h-2.5 rounded w-[83%] shimmer-line" />
                    <div className="h-2.5 rounded w-[62%] shimmer-line" />
                  </div>
                )}

                {/* Error */}
                {error && !loading && (
                  <div className="flex items-center gap-3 py-0.5">
                    <span className="text-[#F87171] text-[11px]">{error}</span>
                    <button onClick={() => void callApi(data)} className="text-[10px] text-zinc-500 hover:text-white border border-[#1E1E1E] px-2 py-0.5 rounded transition-colors">
                      Retry
                    </button>
                  </div>
                )}

                {result && (
                  <>
                    {/* Paragraph — shimmer sweep on refresh */}
                    <div className="relative">
                      <p className={`text-zinc-300 text-[13px] leading-relaxed transition-opacity ${loading ? 'opacity-30' : 'opacity-100'}`}>
                        {parseWithBadges(result.paragraph, knownTickers, onSelectTicker)}
                      </p>
                      {loading && <div className="absolute inset-0 rounded overflow-hidden pointer-events-none"><div className="shimmer-sweep h-full" /></div>}
                    </div>

                    {/* Callout status cards — 2×2 grid on mobile, row on wider screens */}
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {result.callouts.map((c, i) => {
                        const cfg = CALLOUT_CONFIG[c.type] ?? CALLOUT_CONFIG.RISK
                        return (
                          <div key={i} className={`flex flex-col gap-1 border rounded-xl px-3 py-2.5 ${cfg.bg} ${cfg.border}`}>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] leading-none">{cfg.icon}</span>
                              <span className={`text-[9px] font-bold uppercase tracking-wider ${cfg.label_color}`}>{c.type}</span>
                            </div>
                            <div className="text-white/80 text-[11px] font-medium leading-tight">{c.label}</div>
                            <div className="text-zinc-500 text-[10px] leading-tight">{c.reason}</div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Footer: source data chips + timestamp */}
                    <div className="flex items-center gap-2 pt-0.5">
                      <span className="text-[9px] text-zinc-700 uppercase tracking-wider flex-shrink-0">Data Sources</span>
                      {sourceChips.map(r => (
                        <button key={r.ticker} onClick={() => onSelectTicker(r.ticker)}
                          className="text-[9px] font-mono text-zinc-500 hover:text-white border border-[#1E1E1E] hover:border-[#333] px-1.5 py-0.5 rounded transition-colors flex-shrink-0">
                          {r.ticker}
                        </button>
                      ))}
                      <div className="flex-1" />
                      <span className="text-zinc-700 text-[9px] flex-shrink-0">Generated {result.generatedTime}</span>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  )
}

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
  const [activeSector,    setActiveSector]    = useState<string | null>(null)
  const [holdingData,     setHoldingData]     = useState<RSRow[]>([])
  const [loadingHoldings, setLoadingHoldings] = useState(false)

  // UI
  const [auditOpen, setAuditOpen] = useState(false)
  const [toast,     setToast]     = useState<string | null>(null)

  // Column sort (replaces dropdown)
  const [sortCol, setSortCol] = useState<SortCol>('rs_momentum')
  const [sortAsc, setSortAsc] = useState(false)
  const handleSort = (col: SortCol) => {
    setSortCol(prev => { if (prev === col) { setSortAsc(a => !a); return prev } setSortAsc(false); return col })
  }

  // Sections: ticker → SectionName, persisted in localStorage
  const [sectionMap, setSectionMap] = useState<Record<string, SectionName>>(() => {
    try { return { ...DEFAULT_SECTION_MAP, ...(JSON.parse(localStorage.getItem('jmn_sections') ?? '{}') as Record<string, SectionName>) } }
    catch { return { ...DEFAULT_SECTION_MAP } }
  })
  const saveSectionMap = (m: Record<string, SectionName>) => {
    setSectionMap(m)
    try { localStorage.setItem('jmn_sections', JSON.stringify(m)) } catch { /* ignore */ }
  }

  // Section collapsed state
  const [collapsed, setCollapsed] = useState<Record<SectionName, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem('jmn_sections_collapsed') ?? '{}') as Record<SectionName, boolean> }
    catch { return {} as Record<SectionName, boolean> }
  })
  const toggleCollapsed = (s: SectionName) => {
    setCollapsed(prev => {
      const next = { ...prev, [s]: !prev[s] }
      try { localStorage.setItem('jmn_sections_collapsed', JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }

  // Per-section manual row order (drag), persisted in localStorage
  const [sectionOrder, setSectionOrder] = useState<Record<SectionName, string[]>>(() => {
    try { return JSON.parse(localStorage.getItem('jmn_sections_order') ?? '{}') as Record<SectionName, string[]> }
    catch { return {} as Record<SectionName, string[]> }
  })
  const saveSectionOrder = (s: SectionName, order: string[]) => {
    setSectionOrder(prev => {
      const next = { ...prev, [s]: order }
      try { localStorage.setItem('jmn_sections_order', JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }

  // Cursor-following chart state
  const [hoveredRS, setHoveredRS] = useState<RSRow | null>(null)
  const [cursor,    setCursor]    = useState<{ x: number; y: number } | null>(null)

  // Responsive
  const breakpoint = useBreakpoint()
  const isDesktop  = breakpoint === 'lg'
  const isTouch    = useIsTouchDevice()
  const { grid: gridCols, cols: visibleCols } = BREAKPOINT_COLS[breakpoint]
  const [mobilePanel, setMobilePanel] = useState<'table' | 'rrg' | 'holdings'>('table')

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const tickers  = groups[activeGroup] ?? []

  const load = useCallback(async (list: string[], refresh = false) => {
    if (list.length === 0) return
    setLoading(true); setError(null)
    try { setData(await fetchRS(list, refresh)) }
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

  // Full reload only when activeGroup switches — uses cache (no refresh)
  useEffect(() => {
    if (!activeGroup) return
    const list = groups[activeGroup] ?? []
    setData([]); setActiveSector(null); setHoldingData([])
    load(list) // serves cached data instantly
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGroup]) // intentionally omit `groups` — ticker add/remove uses incremental update below

  // When tickers are added to the active group, fetch only new ones and merge
  const prevTickersRef = useRef<string[]>([])
  useEffect(() => {
    const list = groups[activeGroup] ?? []
    const prev = prevTickersRef.current
    prevTickersRef.current = list
    const added = list.filter(t => !prev.includes(t))
    if (added.length === 0 || prev.length === 0) return // skip on initial load (handled above)
    fetchRS(added)
      .then((newRows: RSRow[]) => setData(d => [...d, ...newRows.filter(r => !d.some(x => x.ticker === r.ticker))]))
      .catch(() => {})
  }, [activeGroup, groups])

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

  const handleAddToSection = async (symbols: string[], section: SectionName) => {
    if (!activeGroup) return
    const newSyms = symbols.filter(s => s && !tickers.includes(s))
    if (newSyms.length === 0) return
    // Assign section before adding so the row lands in the right place immediately
    const newMap = { ...sectionMap }
    for (const sym of newSyms) newMap[sym] = section
    saveSectionMap(newMap)
    let updated = groups
    for (const sym of newSyms) updated = await addTickerToGroup(activeGroup, sym)
    setGroups(updated)
  }

  const handleRemove = async (ticker: string) => {
    if (!activeGroup) return
    if (!confirm(`Remove ${ticker} from ${activeGroup}?`)) return
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

  const handleAddFromAudit = async (ticker: string) => {
    if (!activeGroup || tickers.includes(ticker)) return
    // Default new audit additions to Thematic ETFs
    if (!sectionMap[ticker]) saveSectionMap({ ...sectionMap, [ticker]: 'Thematic ETFs' })
    const updated = await addTickerToGroup(activeGroup, ticker)
    setGroups(updated)
    try { localStorage.setItem(`rs-tickers-${activeGroup}`, JSON.stringify(updated[activeGroup] ?? [])) } catch { /* ignore */ }
    setToast(`${ticker} added to your dashboard`)
    load(updated[activeGroup] ?? [])
  }

  // Card click: set active sector for drill-down
  const handleCardClick = (ticker: string) => {
    setSelectedTicker(ticker)
    setActiveSector(prev => prev === ticker ? null : ticker) // toggle off on second click
  }

  // Sort helper — computes a sort value for a row given the current sortCol
  const sortValue = (row: RSRow): number => {
    const c = row.candles
    switch (sortCol) {
      case 'ticker':      return row.ticker.charCodeAt(0)
      case 'price':       return row.price
      case 'change1d':    return c.length >= 2 ? (c.at(-1)!.close - c.at(-2)!.close) / c.at(-2)!.close : 0
      case 'change1w':    return c.length >= 6 ? (c.at(-1)!.close - c.at(-6)!.close) / c.at(-6)!.close : 0
      case 'high52w': {
        const h = c.length > 0 ? Math.max(...c.map(x => x.high)) : row.price
        return (row.price - h) / h
      }
      case 'ytd': {
        const yr = new Date().getFullYear()
        const s  = c.find(x => x.time.startsWith(`${yr}-`))
        return s ? (row.price - s.open) / s.open : 0
      }
      case 'rs_momentum': return row.rs_momentum
      default:            return row.rs_momentum
    }
  }

  const sortRows = (rows: RSRow[]) =>
    [...rows].sort((a, b) => sortAsc ? sortValue(a) - sortValue(b) : sortValue(b) - sortValue(a))

  // Build per-section rows: apply saved order first, then sort on top if active
  const sectionRows = (section: SectionName): RSRow[] => {
    const base = data.filter(r => (sectionMap[r.ticker] ?? 'Thematic ETFs') === section)
    const order = sectionOrder[section]
    const ordered = order
      ? [...base].sort((a, b) => {
          const ia = order.indexOf(a.ticker)
          const ib = order.indexOf(b.ticker)
          if (ia === -1 && ib === -1) return 0
          if (ia === -1) return 1
          if (ib === -1) return -1
          return ia - ib
        })
      : base
    return sortRows(ordered)
  }

  const sortActive = true // always show sort arrows; drag hidden when sorted

  const activeETFRow = data.find(r => r.ticker === activeSector) ?? null

  const showTable = isDesktop || mobilePanel === 'table'
  const showRRG   = isDesktop || mobilePanel === 'rrg'
  const showHoldings = !isDesktop && mobilePanel === 'holdings'

  return (
    <div className="flex-1 flex flex-col bg-[#0A0A0A] text-white font-sans overflow-hidden">

      {/* ── AI Market Summary banner ── */}
      <AIMarketSummary data={data} onSelectTicker={handleCardClick} />

      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">

      {/* ── Left: Sectioned Row Table ── */}
      {showTable && (
      <div className="flex flex-col w-full lg:w-[60%] lg:border-r border-white/[0.06] overflow-hidden">

        {/* Group tabs — Row 1 */}
        <div className="flex-shrink-0 border-b border-white/[0.06] bg-[#0A0A0A]">
          <div className="flex items-center px-3 sm:px-4 pt-1.5 overflow-x-auto scrollbar-none">
            <div className="flex items-center gap-0.5 min-w-0 flex-1">
              {Object.keys(groups).map(name => (
                <div key={name} className="flex items-center flex-shrink-0">
                  <button
                    onClick={() => setActiveGroup(name)}
                    className={`px-2 sm:px-3 py-2 text-[11px] font-medium transition-all relative ${
                      activeGroup === name
                        ? 'text-white'
                        : 'text-zinc-600 hover:text-zinc-400'
                    }`}
                  >
                    {name}
                    <span className={`ml-1 sm:ml-1.5 text-[9px] tabular-nums ${activeGroup === name ? 'text-zinc-500' : 'text-zinc-700'}`}>
                      {(groups[name] ?? []).length}
                    </span>
                    {activeGroup === name && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute bottom-0 left-1 right-1 h-[2px] bg-[#3B82F6] rounded-full"
                        transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
                      />
                    )}
                  </button>
                  {activeGroup === name && name !== 'Sector ETFs' && (
                    <button onClick={() => handleDeleteGroup(name)}
                      className="text-zinc-700 hover:text-rose-500 transition-colors -ml-1 mr-1">
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
                  className="flex-shrink-0 px-2 py-2 text-zinc-700 hover:text-[#3B82F6] transition-colors">
                  <Plus size={12} />
                </button>
              )}
            </div>
            {/* Desktop-only action bar (inline with tabs) */}
            <div className="hidden lg:flex items-center gap-2.5 flex-shrink-0 pl-3 pb-1">
              {error && <span className="text-rose-500 text-[10px]">{error}</span>}
              {activeSector && (
                <span className="text-[10px] text-blue-400/70 flex items-center gap-1.5 bg-blue-500/[0.08] border border-blue-500/20 rounded-full px-2 py-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500/60" />
                  {activeSector}
                  <button onClick={() => { setActiveSector(null); setHoldingData([]) }}
                    className="text-zinc-600 hover:text-zinc-300 ml-0.5 leading-none">×</button>
                </span>
              )}
              <button
                onClick={() => setAuditOpen(true)}
                title="Audit My Coverage"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-purple-500/20 text-purple-400 hover:bg-purple-500/10 hover:border-purple-500/30 transition-all text-[10px] font-medium"
              >
                <Sparkles size={10} />
                Audit
              </button>
              <button onClick={() => load(tickers, true)} disabled={loading}
                className="text-zinc-600 hover:text-white transition-colors disabled:opacity-30 p-1">
                <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>
          {/* Mobile action bar — Row 2 */}
          <div className="flex lg:hidden items-center gap-2 px-3 py-1.5 border-t border-white/[0.04]">
            {error && <span className="text-rose-500 text-[10px]">{error}</span>}
            {activeSector && (
              <span className="text-[10px] text-blue-400/70 flex items-center gap-1.5 bg-blue-500/[0.08] border border-blue-500/20 rounded-full px-2 py-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500/60" />
                {activeSector}
                <button onClick={() => { setActiveSector(null); setHoldingData([]) }}
                  className="text-zinc-600 hover:text-zinc-300 ml-0.5 leading-none">×</button>
              </span>
            )}
            <div className="flex-1" />
            <button
              onClick={() => setAuditOpen(true)}
              className="flex items-center gap-1 px-2 py-1 rounded-md border border-purple-500/20 text-purple-400 hover:bg-purple-500/10 transition-all text-[10px] font-medium"
            >
              <Sparkles size={10} />
              <span className="hidden sm:inline">Audit</span>
            </button>
            <button onClick={() => load(tickers, true)} disabled={loading}
              className="text-zinc-600 hover:text-white transition-colors disabled:opacity-30 p-1">
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Row table */}
        <div className="flex flex-col flex-1 overflow-y-auto">
          {loading && data.length === 0 && (
            <div className="text-zinc-600 text-xs text-center mt-10">Loading RS data…</div>
          )}
          {data.length > 0 && (
            <>
              {/* Sticky column header with sortable labels */}
              <div
                className="grid items-center px-3 py-2 bg-[#0A0A0A]/95 backdrop-blur-sm border-b border-white/[0.06] sticky top-0 z-10 flex-shrink-0"
                style={{ gridTemplateColumns: gridCols }}
              >
                {visibleCols.has('drag') && <span />}
                <SortableHeader label="Asset"    col="ticker"      current={sortCol} asc={sortAsc} onSort={handleSort} />
                <SortableHeader label="Price"    col="price"       current={sortCol} asc={sortAsc} onSort={handleSort} />
                <SortableHeader label="1D%"      col="change1d"    current={sortCol} asc={sortAsc} onSort={handleSort} />
                <SortableHeader label="1W%"      col="change1w"    current={sortCol} asc={sortAsc} onSort={handleSort} visible={visibleCols.has('change1w')} />
                <SortableHeader label="52W HI%"  col="high52w"     current={sortCol} asc={sortAsc} onSort={handleSort} visible={visibleCols.has('high52w')} />
                <SortableHeader label="YTD%"     col="ytd"         current={sortCol} asc={sortAsc} onSort={handleSort} visible={visibleCols.has('ytd')} />
                <SortableHeader label="5D Trend" col={null}        current={sortCol} asc={sortAsc} onSort={handleSort} visible={visibleCols.has('trend')} />
                <SortableHeader label="RS Mom"   col="rs_momentum" current={sortCol} asc={sortAsc} onSort={handleSort} />
                {visibleCols.has('remove') && <span />}
              </div>

              {/* Three sections */}
              {SECTIONS.map(section => {
                const rows = sectionRows(section)
                return (
                  <div key={section}>
                    <SectionHeader
                      name={section}
                      count={rows.length}
                      collapsed={!!collapsed[section]}
                      onToggle={() => toggleCollapsed(section)}
                      onAdd={handleAddToSection}
                    />
                    {!collapsed[section] && (
                      <Reorder.Group
                        axis="y"
                        values={rows}
                        onReorder={newRows => saveSectionOrder(section, newRows.map(r => r.ticker))}
                        className="relative"
                        as="div"
                      >
                        {rows.map(row => (
                          <TickerRow
                            key={row.ticker}
                            row={row}
                            isSelected={activeSector === row.ticker}
                            sortActive={sortActive}
                            visibleCols={visibleCols}
                            gridCols={gridCols}
                            isTouch={isTouch}
                            onSelect={handleCardClick}
                            onRemove={handleRemove}
                            onHover={setHoveredRS}
                            onCursorMove={setCursor}
                          />
                        ))}
                      </Reorder.Group>
                    )}
                  </div>
                )
              })}
            </>
          )}
        </div>
      </div>
      )}

      {/* ── Cursor-following chart popup (desktop only) ── */}
      {hoveredRS && cursor && !isTouch && (
        <CursorChart row={hoveredRS} cursor={cursor} />
      )}

      {/* ── Audit Modal ── */}
      <AnimatePresence>
        {auditOpen && (
          <AuditModal
            tickers={tickers}
            trackedTickers={tickers}
            onClose={() => setAuditOpen(false)}
            onAdd={handleAddFromAudit}
          />
        )}
      </AnimatePresence>

      {/* ── Toast ── */}
      <AnimatePresence>
        {toast && <Toast message={toast} onDone={() => setToast(null)} />}
      </AnimatePresence>

      {/* ── Right: RRG + Holdings Drill-down ── */}
      {showRRG && (
      <div className="flex flex-col w-full lg:w-[40%] overflow-y-auto">

        {/* RRG */}
        <div className="flex-shrink-0 border-b border-white/[0.06] p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-1 w-1 rounded-full bg-[#3B82F6]" />
            <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-medium">Relative Rotation Graph</span>
          </div>
          {data.length > 0
            ? <RRGChart data={data} onSelect={handleCardClick} />
            : <div className="text-zinc-700 text-xs text-center py-8">Waiting for data…</div>}
        </div>

        {/* Holdings panel (drill-down) */}
        <div className="flex flex-col flex-1 bg-[#0A0A0A]">
          <HoldingsPanel
            etfRow={activeETFRow}
            holdingRows={holdingData}
            loading={loadingHoldings}
          />
        </div>
      </div>
      )}

      </div>

      {/* ── Mobile Holdings panel ── */}
      {showHoldings && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <HoldingsPanel
            etfRow={activeETFRow}
            holdingRows={holdingData}
            loading={loadingHoldings}
          />
        </div>
      )}

      {/* ── Mobile bottom tab bar ── */}
      {!isDesktop && (
        <div className="flex-shrink-0 flex border-t border-white/[0.06] bg-[#0A0A0A]/95 backdrop-blur-sm">
          <button
            onClick={() => setMobilePanel('table')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-medium transition-colors ${
              mobilePanel === 'table' ? 'text-[#3B82F6]' : 'text-zinc-600'
            }`}
          >
            <TableProperties size={14} />
            Table
          </button>
          <button
            onClick={() => setMobilePanel('rrg')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-medium transition-colors ${
              mobilePanel === 'rrg' ? 'text-[#3B82F6]' : 'text-zinc-600'
            }`}
          >
            <BarChart3 size={14} />
            RRG
          </button>
          <button
            onClick={() => setMobilePanel('holdings')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-medium transition-colors ${
              mobilePanel === 'holdings' ? 'text-[#3B82F6]' : 'text-zinc-600'
            }`}
          >
            <LayoutGrid size={14} />
            Holdings
          </button>
        </div>
      )}
    </div>
  )
}
