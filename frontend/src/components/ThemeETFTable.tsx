import { useState, useEffect, useRef } from 'react'
import { createChart, ColorType, CrosshairMode, CandlestickSeries, HistogramSeries } from 'lightweight-charts'
import * as HoverCard from '@radix-ui/react-hover-card'
import { ChevronDown } from 'lucide-react'
import { fetchRS, fetchHoldings } from '../api'
import { quadrant, QUAD_COLOR, QUAD_LABEL, QUAD_BG, type Quadrant } from '../lib/quadrant'
import { Sparkline } from './ui/Sparkline'

interface RSData {
  ticker: string
  rs_slope: number
  rs_strength: number
  rs_momentum: number
  price?: number
  rs_norm?: number[]
  candles?: { time: string; open: number; high: number; low: number; close: number; volume?: number }[]
  pct_1w?: number | null
  pct_1m?: number | null
  ytd_pct?: number | null
  from_high_pct?: number | null
}

interface ThemeETFTableProps {
  themeName: string
  etfTickers: string[]
  rsData: RSData[]
}

interface HoldingRow {
  ticker: string
  pct_1w: number | null
  pct_1m: number | null
  from_high_pct: number | null
  price: number | null
}

// Session cache — avoids re-fetching the same ticker on every hover
const rsCache = new Map<string, RSData>()

// ─── Mini candle chart for ETF hover ───────────────────────────────────────────
function ETFMiniChart({ ticker }: { ticker: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seriesRef = useRef<{ candle: any; vol: any } | null>(null)

  useEffect(() => {
    if (!ref.current) return
    const chart = createChart(ref.current, {
      width: ref.current.clientWidth || 300,
      height: 160,
      layout: { background: { type: ColorType.Solid, color: '#0b0f1a' }, textColor: '#8892a8' },
      grid: { vertLines: { visible: false }, horzLines: { visible: false } },
      crosshair: { mode: CrosshairMode.Hidden },
      rightPriceScale: { visible: false },
      leftPriceScale: { visible: false },
      timeScale: { visible: true, borderVisible: false, timeVisible: false },
      handleScroll: false,
      handleScale: false,
    })
    const candle = chart.addSeries(CandlestickSeries, {
      upColor: '#39d67b', downColor: '#ff5e7a',
      borderUpColor: '#39d67b', borderDownColor: '#ff5e7a',
      wickUpColor: '#39d67b', wickDownColor: '#ff5e7a',
    })
    const vol = chart.addSeries(HistogramSeries, {
      color: 'rgba(57,214,123,0.4)',
      priceFormat: { type: 'volume' },
      priceScaleId: 'vol',
    })
    chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } })
    chartRef.current = chart
    seriesRef.current = { candle, vol }

    const ro = new ResizeObserver(() => {
      if (ref.current && chartRef.current) chartRef.current.applyOptions({ width: ref.current.clientWidth })
    })
    if (ref.current) ro.observe(ref.current)
    return () => { ro.disconnect(); chart.remove(); chartRef.current = null; seriesRef.current = null }
  }, [ticker])

  useEffect(() => {
    if (!seriesRef.current) return
    const apply = (row: RSData) => {
      if (!row?.candles?.length || !seriesRef.current) return
      const { candle, vol } = seriesRef.current
      candle.setData(row.candles)
      vol.setData(row.candles.map((c: { time: string; open: number; high: number; low: number; close: number; volume?: number }) => ({
        time: c.time,
        value: c.volume ?? 0,
        color: c.close >= c.open ? 'rgba(57,214,123,0.4)' : 'rgba(255,94,122,0.4)',
      })))
      chartRef.current?.timeScale().fitContent()
    }
    const cached = rsCache.get(ticker)
    if (cached) { apply(cached); return }
    fetchRS([ticker])
      .then((data: unknown) => {
        const row = (data as RSData[])[0]
        if (!row) return
        rsCache.set(ticker, row)
        apply(row)
      })
      .catch(() => {})
  }, [ticker])

  return <div ref={ref} className="w-full" />
}

// ─── Holding row (presentational — data fetched in one batch by the parent) ────
function HoldingTickerRow({ row, rank }: { row: HoldingRow; rank: number }) {
  return (
    <div
      className="grid items-center gap-2 px-4 py-1.5 text-[10px] font-mono tabular-nums border-b"
      style={{ borderColor: 'var(--line)', gridTemplateColumns: '20px 1fr 70px 70px 70px 70px' }}
    >
      <span style={{ color: 'var(--muted-2)' }}>{rank}</span>
      <span className="text-[11px] font-semibold" style={{ color: 'var(--text)' }}>{row.ticker}</span>
      <span style={{ color: (row.pct_1w ?? 0) >= 0 ? 'var(--up)' : 'var(--down)' }}>
        {row.pct_1w != null ? `${row.pct_1w >= 0 ? '+' : ''}${row.pct_1w.toFixed(1)}%` : '—'}
      </span>
      <span style={{ color: (row.pct_1m ?? 0) >= 0 ? 'var(--up)' : 'var(--down)' }}>
        {row.pct_1m != null ? `${row.pct_1m >= 0 ? '+' : ''}${row.pct_1m.toFixed(1)}%` : '—'}
      </span>
      <span style={{ color: (row.from_high_pct ?? 0) >= -5 ? 'var(--up)' : 'var(--down)' }}>
        {row.from_high_pct != null ? `${row.from_high_pct.toFixed(1)}%` : '—'}
      </span>
      <span style={{ color: 'var(--muted)' }}>
        {row.price != null ? `$${row.price.toFixed(2)}` : '—'}
      </span>
    </div>
  )
}

// ─── Main Leaderboard ──────────────────────────────────────────────────────────
type SortCol = 'rs_slope' | 'pct_1w' | 'pct_1m' | 'ytd_pct' | 'from_high_pct' | 'price'

const GRID_COLS = '32px 68px 1fr 100px 70px 70px 70px 70px 76px 24px'

const QUAD_SHORT: Record<Quadrant, string> = {
  leading: 'LEAD', improving: 'IMPR', weakening: 'WEAK', lagging: 'LAG',
}

export default function ThemeETFTable({ themeName, etfTickers, rsData }: ThemeETFTableProps) {
  const [expandedETF, setExpandedETF] = useState<string | null>(null)
  const [sortCol, setSortCol] = useState<SortCol>('rs_slope')
  const [sortDir, setSortDir] = useState<1 | -1>(-1)
  const [holdingRows, setHoldingRows] = useState<Record<string, HoldingRow[] | undefined>>({})
  const [quadFilter, setQuadFilter] = useState<Quadrant | 'all'>('all')

  const displayData = etfTickers
    .map(t => rsData.find(r => r.ticker === t))
    .filter((r): r is RSData => r !== undefined)

  const quadCounts = { leading: 0, improving: 0, weakening: 0, lagging: 0 } as Record<Quadrant, number>
  for (const r of displayData) quadCounts[quadrant(r.rs_strength, r.rs_momentum)]++

  const filtered = quadFilter === 'all'
    ? displayData
    : displayData.filter(r => quadrant(r.rs_strength, r.rs_momentum) === quadFilter)

  const sorted = [...filtered].sort((a, b) => {
    let av: number, bv: number
    switch (sortCol) {
      case 'pct_1w': av = a.pct_1w ?? -999; bv = b.pct_1w ?? -999; break
      case 'pct_1m': av = a.pct_1m ?? -999; bv = b.pct_1m ?? -999; break
      case 'ytd_pct': av = a.ytd_pct ?? -999; bv = b.ytd_pct ?? -999; break
      case 'from_high_pct': av = a.from_high_pct ?? 999; bv = b.from_high_pct ?? 999; break
      case 'price': av = a.price ?? 0; bv = b.price ?? 0; break
      default: av = a.rs_slope; bv = b.rs_slope
    }
    return (av > bv ? 1 : av < bv ? -1 : 0) * sortDir
  })

  const handleSort = (col: SortCol) => {
    if (sortCol === col) setSortDir(d => d === 1 ? -1 : 1)
    else { setSortCol(col); setSortDir(-1) }
  }

  const toggleETF = (ticker: string) => {
    if (expandedETF === ticker) {
      setExpandedETF(null)
      return
    }
    setExpandedETF(ticker)
    if (holdingRows[ticker]) return
    // One holdings call + one batched RS call — not one request per holding
    fetchHoldings([ticker])
      .then(h => {
        const list = (h[ticker] ?? []).slice(0, 10)
        if (!list.length) {
          setHoldingRows(prev => ({ ...prev, [ticker]: [] }))
          return
        }
        return fetchRS(list).then((rows: unknown) => {
          const byTicker = new Map((rows as RSData[]).map(r => [r.ticker, r]))
          const mapped: HoldingRow[] = list.map(t => {
            const r = byTicker.get(t)
            return {
              ticker: t,
              pct_1w: r?.pct_1w ?? null,
              pct_1m: r?.pct_1m ?? null,
              from_high_pct: r?.from_high_pct ?? null,
              price: r?.price ?? null,
            }
          })
          setHoldingRows(prev => ({ ...prev, [ticker]: mapped }))
        })
      })
      .catch(() => setHoldingRows(prev => ({ ...prev, [ticker]: [] })))
  }

  const sortArrow = (col: SortCol) => sortCol === col ? (sortDir === 1 ? '↑' : '↓') : ''
  const thStyle = { color: 'var(--muted-2)' }

  return (
    <div className="flex flex-col px-5 py-4">
      {/* Panel wrapper */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}
      >
        {/* Panel header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: 'var(--line)' }}
        >
          <div className="flex items-baseline gap-3">
            <span className="text-[14px] font-semibold" style={{ color: 'var(--text)' }}>
              {themeName}
            </span>
            <span className="font-mono text-[10px] tracking-[0.15em] uppercase" style={{ color: 'var(--muted-2)' }}>
              {sorted.length} ETFs
            </span>
          </div>

          {/* Quadrant filter pills */}
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            <button
              onClick={() => setQuadFilter('all')}
              className="h-6 px-2 rounded-full font-mono text-[9px] font-semibold tracking-[0.08em] border transition-colors"
              style={{
                background: quadFilter === 'all' ? 'var(--panel-hi)' : 'transparent',
                borderColor: quadFilter === 'all' ? 'var(--line-2)' : 'var(--line)',
                color: quadFilter === 'all' ? 'var(--text)' : 'var(--muted)',
              }}
            >
              ALL
            </button>
            {(['leading', 'improving', 'weakening', 'lagging'] as Quadrant[]).map(q => (
              <button
                key={q}
                onClick={() => setQuadFilter(f => f === q ? 'all' : q)}
                title={QUAD_LABEL[q]}
                className="h-6 px-2 rounded-full font-mono text-[9px] font-semibold tracking-[0.08em] border transition-colors flex items-center gap-1"
                style={{
                  background: quadFilter === q ? QUAD_BG[q] : 'transparent',
                  borderColor: quadFilter === q ? QUAD_COLOR[q] : 'var(--line)',
                  color: quadFilter === q ? QUAD_COLOR[q] : 'var(--muted)',
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: QUAD_COLOR[q] }} />
                {QUAD_SHORT[q]} · {quadCounts[q]}
              </button>
            ))}
          </div>
        </div>

        {/* Scroll container — grid is ~840px wide; scroll here instead of clipping */}
        <div className="overflow-x-auto">
        <div className="min-w-[840px]">

        {/* Leaderboard header */}
        <div
          className="grid items-center gap-3 px-4 py-2 border-b font-mono text-[9px] uppercase tracking-[0.12em] font-semibold"
          style={{ borderColor: 'var(--line)', gridTemplateColumns: GRID_COLS }}
        >
          <span style={thStyle}>#</span>
          <span style={thStyle}>TICKER</span>
          <span style={thStyle}>THEME · STATUS</span>
          <button
            className="text-left hover:opacity-80 transition-opacity uppercase"
            onClick={() => handleSort('rs_slope')}
            title="Relative strength vs SPY — 25-day slope"
            style={thStyle}
          >RS 25D {sortArrow('rs_slope')}</button>
          <button className="text-left hover:opacity-80 transition-opacity uppercase" onClick={() => handleSort('pct_1w')} style={thStyle}>1W {sortArrow('pct_1w')}</button>
          <button className="text-left hover:opacity-80 transition-opacity uppercase" onClick={() => handleSort('pct_1m')} style={thStyle}>1M {sortArrow('pct_1m')}</button>
          <button className="text-left hover:opacity-80 transition-opacity uppercase" onClick={() => handleSort('ytd_pct')} style={thStyle}>YTD {sortArrow('ytd_pct')}</button>
          <button
            className="text-left hover:opacity-80 transition-opacity uppercase"
            onClick={() => handleSort('from_high_pct')}
            title="Distance from 52-week high — green when within 5%"
            style={thStyle}
          >52W HI {sortArrow('from_high_pct')}</button>
          <button className="text-right hover:opacity-80 transition-opacity uppercase" onClick={() => handleSort('price')} style={thStyle}>PRICE {sortArrow('price')}</button>
          <span></span>
        </div>

        {/* Rows */}
        {sorted.map((row, i) => {
          const quad = quadrant(row.rs_strength, row.rs_momentum)
          const quadColor = QUAD_COLOR[quad]
          const expanded = expandedETF === row.ticker
          return (
            <div key={row.ticker}>
              <HoverCard.Root>
                <HoverCard.Trigger asChild>
                  <div
                    role="button"
                    tabIndex={0}
                    aria-expanded={expanded}
                    aria-label={`${row.ticker} — ${QUAD_LABEL[quad]} — ${expanded ? 'collapse' : 'expand'} holdings`}
                    className="grid items-center gap-3 px-4 py-3 cursor-pointer transition-colors border-b relative"
                    style={{
                      gridTemplateColumns: GRID_COLS,
                      borderColor: 'var(--line)',
                      background: expanded ? 'var(--panel-hi)' : 'transparent',
                    }}
                    onClick={() => toggleETF(row.ticker)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        toggleETF(row.ticker)
                      }
                    }}
                    onMouseEnter={e => { if (!expanded) e.currentTarget.style.background = 'var(--panel)' }}
                    onMouseLeave={e => { if (!expanded) e.currentTarget.style.background = 'transparent' }}
                  >
                    {/* Quadrant left rail */}
                    <span
                      className="absolute top-0 left-0 bottom-0 w-[3px]"
                      style={{ background: quadColor }}
                    />

                    <span className="font-mono text-[11px] tabular-nums" style={{ color: 'var(--muted-2)' }}>
                      {i + 1}
                    </span>
                    <span className="text-[13px] font-bold tracking-tight" style={{ color: 'var(--text)' }}>
                      {row.ticker}
                    </span>

                    {/* Theme + status chip */}
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[11px] truncate" style={{ color: 'var(--muted)' }}>
                        {themeName}
                      </span>
                      <span
                        className="font-mono text-[9px] font-semibold tracking-[0.1em] px-1.5 py-0.5 rounded-[4px] flex-shrink-0"
                        style={{ background: QUAD_BG[quad], color: quadColor }}
                      >
                        {QUAD_LABEL[quad]}
                      </span>
                    </div>

                    {/* Sparkline */}
                    <div className="flex items-center">
                      <Sparkline values={row.rs_norm ?? []} color={quadColor} width={90} height={28} />
                    </div>

                    <span className="font-mono text-[11px] tabular-nums" style={{ color: (row.pct_1w ?? 0) >= 0 ? 'var(--up)' : 'var(--down)' }}>
                      {row.pct_1w != null ? `${row.pct_1w >= 0 ? '+' : ''}${row.pct_1w.toFixed(1)}%` : '—'}
                    </span>
                    <span className="font-mono text-[11px] tabular-nums" style={{ color: (row.pct_1m ?? 0) >= 0 ? 'var(--up)' : 'var(--down)' }}>
                      {row.pct_1m != null ? `${row.pct_1m >= 0 ? '+' : ''}${row.pct_1m.toFixed(1)}%` : '—'}
                    </span>
                    <span className="font-mono text-[11px] tabular-nums" style={{ color: (row.ytd_pct ?? 0) >= 0 ? 'var(--up)' : 'var(--down)' }}>
                      {row.ytd_pct != null ? `${row.ytd_pct >= 0 ? '+' : ''}${row.ytd_pct.toFixed(1)}%` : '—'}
                    </span>
                    <span
                      className="font-mono text-[11px] tabular-nums"
                      title="Distance from 52-week high — green when within 5%"
                      style={{ color: (row.from_high_pct ?? 0) >= -5 ? 'var(--up)' : 'var(--down)' }}
                    >
                      {row.from_high_pct != null ? `${row.from_high_pct.toFixed(1)}%` : '—'}
                    </span>
                    <span className="font-mono text-[11px] tabular-nums text-right" style={{ color: 'var(--text)' }}>
                      ${(row.price ?? 0).toFixed(2)}
                    </span>
                    <span className="flex justify-end" style={{ color: 'var(--muted-2)' }}>
                      <ChevronDown
                        size={13}
                        className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
                      />
                    </span>
                  </div>
                </HoverCard.Trigger>
                <HoverCard.Portal>
                  <HoverCard.Content
                    className="rounded-xl border shadow-2xl overflow-hidden z-50"
                    sideOffset={4}
                    style={{ width: 320, background: '#0b0f1a', borderColor: 'var(--line-2)' }}
                  >
                    <div
                      className="px-3 py-2 border-b flex items-center justify-between"
                      style={{ borderColor: 'var(--line)' }}
                    >
                      <span className="text-[11px] font-bold" style={{ color: 'var(--text)' }}>{row.ticker}</span>
                      <span className="font-mono text-[9px]" style={{ color: 'var(--muted-2)' }}>3mo · daily</span>
                    </div>
                    <ETFMiniChart ticker={row.ticker} />
                    <HoverCard.Arrow style={{ fill: 'var(--line-2)' }} />
                  </HoverCard.Content>
                </HoverCard.Portal>
              </HoverCard.Root>

              {/* Expanded holdings */}
              {expanded && (
                <div style={{ background: 'var(--panel)' }}>
                  <div
                    className="px-4 py-2 font-mono text-[9px] uppercase tracking-[0.15em] font-semibold border-b"
                    style={{ borderColor: 'var(--line)', color: 'var(--muted-2)' }}
                  >
                    Top Holdings — {row.ticker}
                  </div>
                  <div
                    className="grid items-center gap-2 px-4 py-2 font-mono text-[9px] uppercase tracking-[0.12em] font-semibold border-b"
                    style={{ borderColor: 'var(--line)', gridTemplateColumns: '20px 1fr 70px 70px 70px 70px', color: 'var(--muted-2)' }}
                  >
                    <span>#</span>
                    <span>HOLDING</span>
                    <span>1W</span>
                    <span>1M</span>
                    <span>52W</span>
                    <span>PRICE</span>
                  </div>
                  {(holdingRows[row.ticker] ?? []).map((h, idx) => (
                    <HoldingTickerRow key={h.ticker} row={h} rank={idx + 1} />
                  ))}
                  {holdingRows[row.ticker] === undefined && (
                    <div className="px-4 py-2 flex flex-col gap-1.5">
                      {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="shimmer-line h-6 rounded-md" />
                      ))}
                    </div>
                  )}
                  {holdingRows[row.ticker]?.length === 0 && (
                    <div className="px-4 py-3 text-[10px]" style={{ color: 'var(--muted-2)' }}>No holdings data available.</div>
                  )}
                </div>
              )}
            </div>
          )
        })}

        </div>
        </div>

        {/* Loading skeleton — rsData not yet fetched */}
        {rsData.length === 0 && (
          <div className="px-4 py-3 flex flex-col gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <div key={i} className="shimmer-line h-[42px] rounded-lg" />
            ))}
          </div>
        )}

        {/* True empty states */}
        {rsData.length > 0 && sorted.length === 0 && quadFilter !== 'all' && (
          <div className="flex flex-col items-center justify-center py-12 text-xs gap-3">
            <div style={{ color: 'var(--muted)' }}>No ETFs in the {QUAD_LABEL[quadFilter]} quadrant.</div>
            <button
              onClick={() => setQuadFilter('all')}
              className="font-mono text-[10px] px-3 py-1.5 rounded-full border transition-colors hover:opacity-80"
              style={{ borderColor: 'var(--line-2)', color: 'var(--text)' }}
            >
              Show all
            </button>
          </div>
        )}
        {rsData.length > 0 && sorted.length === 0 && quadFilter === 'all' && (
          <div className="flex flex-col items-center justify-center py-12 text-xs gap-3">
            <div style={{ color: 'var(--muted)' }}>No ETF data available for this theme.</div>
            <div style={{ color: 'var(--muted-2)' }}>Theme: {themeName}</div>
          </div>
        )}
      </div>
    </div>
  )
}
