import { useState, useEffect, useRef } from 'react'
import { createChart, ColorType, CrosshairMode, CandlestickSeries, HistogramSeries } from 'lightweight-charts'
import * as HoverCard from '@radix-ui/react-hover-card'
import { fetchRS, fetchHoldings } from '../api'

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
  rs_slope: number
  pct_1w: number | null
  pct_1m: number | null
  from_high_pct: number
  price: number
}

// ─── Mini candle chart for ETF row hover ───────────────────────────────────────
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
      layout: { background: { type: ColorType.Solid, color: '#0d1117' }, textColor: '#6e7681' },
      grid: { vertLines: { visible: false }, horzLines: { visible: false } },
      crosshair: { mode: CrosshairMode.Hidden },
      rightPriceScale: { visible: false },
      leftPriceScale: { visible: false },
      timeScale: { visible: true, borderVisible: false, timeVisible: false },
      handleScroll: false,
      handleScale: false,
    })
    const candle = chart.addSeries(CandlestickSeries, {
      upColor: '#2ea043', downColor: '#f85149',
      borderUpColor: '#2ea043', borderDownColor: '#f85149',
      wickUpColor: '#2ea043', wickDownColor: '#f85149',
    })
    const vol = chart.addSeries(HistogramSeries, {
      color: 'rgba(46,160,67,0.4)',
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
    fetchRS([ticker])
      .then((data: unknown) => {
        const rows = data as RSData[]
        const row = rows[0]
        if (!row?.candles?.length) return
        const { candle, vol } = seriesRef.current!
        candle.setData(row.candles)
        vol.setData(row.candles.map((c: { time: string; open: number; high: number; low: number; close: number; volume?: number }) => ({
          time: c.time,
          value: c.volume ?? 0,
          color: c.close >= c.open ? 'rgba(46,160,67,0.4)' : 'rgba(248,81,73,0.4)',
        })))
        chartRef.current?.timeScale().fitContent()
      })
      .catch(() => {})
  }, [ticker])

  return <div ref={ref} className="w-full" />
}

// ─── Holding ticker row (shown in expanded section) ────────────────────────────
function HoldingTickerRow({ ticker, rank }: { ticker: string; rank: number }) {
  const [data, setData] = useState<HoldingRow | null>(null)

  useEffect(() => {
    fetchRS([ticker])
      .then((rows: unknown) => {
        const r = (rows as RSData[])[0]
        if (!r) return
        setData({
          ticker: r.ticker,
          rs_slope: r.rs_slope,
          pct_1w: r.pct_1w ?? null,
          pct_1m: r.pct_1m ?? null,
          from_high_pct: r.from_high_pct ?? 0,
          price: r.price ?? 0,
        })
      })
      .catch(() => {})
  }, [ticker])

  return (
    <div
      className="grid items-center gap-2 px-4 py-1.5 border-b border-white/[0.03] hover:bg-[#161b22] transition-colors"
      style={{ gridTemplateColumns: '20px 1fr 60px 60px 60px 60px 60px' }}
    >
      <span className="text-zinc-600 text-[9px]">{rank}</span>
      <span className="font-bold text-zinc-200 text-[11px]">{ticker}</span>
      {data ? (
        <>
          <span className="text-[10px] font-mono" style={{ color: data.rs_slope >= 0 ? '#2ea043' : '#f85149' }}>
            {data.rs_slope >= 0 ? '+' : ''}{data.rs_slope.toFixed(3)}
          </span>
          <span className="text-[10px] font-mono" style={{ color: (data.pct_1w ?? 0) >= 0 ? '#2ea043' : '#f85149' }}>
            {data.pct_1w != null ? `${data.pct_1w >= 0 ? '+' : ''}${data.pct_1w.toFixed(1)}%` : '—'}
          </span>
          <span className="text-[10px] font-mono" style={{ color: (data.pct_1m ?? 0) >= 0 ? '#2ea043' : '#f85149' }}>
            {data.pct_1m != null ? `${data.pct_1m >= 0 ? '+' : ''}${data.pct_1m.toFixed(1)}%` : '—'}
          </span>
          <span className="text-[10px] font-mono" style={{ color: data.from_high_pct >= -5 ? '#2ea043' : '#f85149' }}>
            {data.from_high_pct.toFixed(1)}%
          </span>
          <span className="text-[10px] font-mono text-zinc-400">${data.price.toFixed(2)}</span>
        </>
      ) : (
        <>
          <span className="text-zinc-600 text-[9px]">—</span>
          <span className="text-zinc-600 text-[9px]">—</span>
          <span className="text-zinc-600 text-[9px]">—</span>
          <span className="text-zinc-600 text-[9px]">—</span>
          <span className="text-zinc-600 text-[9px]">—</span>
        </>
      )}
    </div>
  )
}

// ─── Main ThemeETFTable ────────────────────────────────────────────────────────
type SortCol = 'rs_slope' | 'pct_1w' | 'pct_1m' | 'ytd_pct' | 'from_high_pct' | 'price'

export default function ThemeETFTable({ themeName, etfTickers, rsData }: ThemeETFTableProps) {
  const [expandedETF, setExpandedETF] = useState<string | null>(null)
  const [sortCol, setSortCol] = useState<SortCol>('pct_1w')
  const [sortDir, setSortDir] = useState<1 | -1>(1)
  const [holdings, setHoldings] = useState<Record<string, string[]>>({})

  const displayData = etfTickers
    .map(ticker => rsData.find(r => r.ticker === ticker))
    .filter((r): r is RSData => r !== undefined)

  const sorted = [...displayData].sort((a, b) => {
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
    else { setSortCol(col); setSortDir(1) }
  }

  const toggleETF = (ticker: string) => {
    if (expandedETF === ticker) {
      setExpandedETF(null)
    } else {
      setExpandedETF(ticker)
      if (!holdings[ticker]) {
        fetchHoldings([ticker]).then((h: unknown) => {
          setHoldings(prev => ({ ...prev, [ticker]: (h as Record<string, string[]>)[ticker] ?? [] }))
        }).catch(() => {})
      }
    }
  }

  const COLS = 'grid-cols-11 gap-2 px-4 py-2 border-b border-white/[0.03]'
  const TH = 'text-[9px] uppercase tracking-widest text-zinc-600 font-semibold cursor-pointer hover:text-zinc-400 select-none'
  const sortArrow = (col: SortCol) => sortCol === col ? (sortDir === 1 ? ' ↑' : ' ↓') : ''

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className={`grid items-center ${COLS} bg-[#0d1117]`}>
        <span className="col-span-1 text-[9px] text-zinc-600">#</span>
        <span className="col-span-2 text-[9px] uppercase tracking-widest text-zinc-600 font-semibold">ETF</span>
        <span className={`${TH} col-span-1`} onClick={() => handleSort('price')}>Price{sortArrow('price')}</span>
        <span className={`${TH} col-span-1`} onClick={() => handleSort('pct_1w')}>1W%{sortArrow('pct_1w')}</span>
        <span className={`${TH} col-span-1`} onClick={() => handleSort('pct_1m')}>1M%{sortArrow('pct_1m')}</span>
        <span className={`${TH} col-span-1`} onClick={() => handleSort('ytd_pct')}>YTD%{sortArrow('ytd_pct')}</span>
        <span className={`${TH} col-span-1`} onClick={() => handleSort('from_high_pct')}>52w Hi%{sortArrow('from_high_pct')}</span>
        <span className="col-span-3" />
      </div>

      {/* ETF rows */}
      {sorted.map((row, i) => (
        <div key={row.ticker}>
          {/* Main ETF row — hover shows chart, click expands holdings */}
          <HoverCard.Root>
            <HoverCard.Trigger asChild>
              <div
                className={`grid items-center ${COLS} cursor-pointer transition-colors ${
                  expandedETF === row.ticker ? 'bg-[#1c2129]' : 'hover:bg-[#161b22]'
                }`}
                onClick={() => toggleETF(row.ticker)}
              >
                <span className="col-span-1 text-zinc-600 font-mono text-[10px]">
                  {i < 2 ? (
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-[#1c3a5f] text-[#58a6ff] text-[9px] font-bold">{i + 1}</span>
                  ) : (
                    <span className="text-zinc-600">{i + 1}</span>
                  )}
                </span>
                <span className="col-span-2 font-bold text-zinc-200 text-[11px]">{row.ticker}</span>
                <span className="col-span-1 font-mono text-[10px] text-zinc-300">${(row.price ?? 0).toFixed(2)}</span>
                <span className="col-span-1 font-mono text-[10px]" style={{ color: (row.pct_1w ?? 0) >= 0 ? '#2ea043' : '#f85149' }}>
                  {row.pct_1w != null ? `${row.pct_1w >= 0 ? '+' : ''}${row.pct_1w.toFixed(1)}%` : '—'}
                </span>
                <span className="col-span-1 font-mono text-[10px]" style={{ color: (row.pct_1m ?? 0) >= 0 ? '#2ea043' : '#f85149' }}>
                  {row.pct_1m != null ? `${row.pct_1m >= 0 ? '+' : ''}${row.pct_1m.toFixed(1)}%` : '—'}
                </span>
                <span className="col-span-1 font-mono text-[10px]" style={{ color: (row.ytd_pct ?? 0) >= 0 ? '#2ea043' : '#f85149' }}>
                  {row.ytd_pct != null ? `${row.ytd_pct >= 0 ? '+' : ''}${row.ytd_pct.toFixed(1)}%` : '—'}
                </span>
                <span className="col-span-1 font-mono text-[10px]" style={{ color: (row.from_high_pct ?? 0) >= -5 ? '#2ea043' : '#f85149' }}>
                  {row.from_high_pct != null ? `${row.from_high_pct.toFixed(1)}%` : '—'}
                </span>
                <span className="col-span-3 flex items-center gap-1">
                  {i < 2 && <span className="text-[7px] bg-[#1c3a5f] text-[#58a6ff] px-1 py-0.5 rounded font-semibold">TOP</span>}
                  {expandedETF === row.ticker ? (
                    <span className="text-zinc-600 text-[9px]">▲</span>
                  ) : (
                    <span className="text-zinc-600 text-[9px]">▼</span>
                  )}
                </span>
              </div>
            </HoverCard.Trigger>
            <HoverCard.Portal>
              <HoverCard.Content
                className="rounded-xl border border-[#2A2A2A] bg-[#0D0D0D] shadow-2xl overflow-hidden z-50"
                sideOffset={4}
                style={{ width: 320 }}
              >
                <div className="px-3 py-2 border-b border-[#1A1A1A] flex items-center justify-between">
                  <span className="text-white text-[11px] font-bold">{row.ticker}</span>
                  <span className="text-zinc-600 text-[9px]">3mo · daily</span>
                </div>
                <ETFMiniChart ticker={row.ticker} />
                <div className="px-3 py-1.5 border-t border-[#1A1A1A] flex gap-4">
                  <span className="text-[9px] text-zinc-600">RS Slope <span className={row.rs_slope >= 0 ? 'text-emerald-400' : 'text-rose-500'}>{row.rs_slope >= 0 ? '+' : ''}{row.rs_slope.toFixed(3)}</span></span>
                  <span className="text-[9px] text-zinc-600">1W% <span className={(row.pct_1w ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-500'}>{row.pct_1w != null ? `${row.pct_1w >= 0 ? '+' : ''}${row.pct_1w.toFixed(1)}%` : '—'}</span></span>
                  <span className="text-[9px] text-zinc-600">1M% <span className={(row.pct_1m ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-500'}>{row.pct_1m != null ? `${row.pct_1m >= 0 ? '+' : ''}${row.pct_1m.toFixed(1)}%` : '—'}</span></span>
                </div>
                <HoverCard.Arrow className="fill-[#2A2A2A]" />
              </HoverCard.Content>
            </HoverCard.Portal>
          </HoverCard.Root>

          {/* Expanded holdings */}
          {expandedETF === row.ticker && (
            <div className="border-b border-white/[0.05]">
              <div className="px-4 py-1.5 text-[9px] uppercase tracking-widest text-zinc-600 font-semibold border-b border-white/[0.03]">
                Top Holdings — {row.ticker}
              </div>
              <div
                className="grid items-center gap-2 px-4 py-1.5 border-b border-white/[0.03] bg-[#161b22]/50"
                style={{ gridTemplateColumns: '20px 1fr 60px 60px 60px 60px 60px' }}
              >
                <span className="text-[9px] text-zinc-600">#</span>
                <span className="text-[9px] uppercase tracking-widest text-zinc-600 font-semibold">Holding</span>
                <span className="text-[9px] uppercase tracking-widest text-zinc-600 font-semibold">RS</span>
                <span className="text-[9px] uppercase tracking-widest text-zinc-600 font-semibold">1W%</span>
                <span className="text-[9px] uppercase tracking-widest text-zinc-600 font-semibold">1M%</span>
                <span className="text-[9px] uppercase tracking-widest text-zinc-600 font-semibold">52w</span>
                <span className="text-[9px] uppercase tracking-widest text-zinc-600 font-semibold">Price</span>
              </div>
              {(holdings[row.ticker] ?? []).slice(0, 10).map((t, idx) => (
                <HoldingTickerRow key={t} ticker={t} rank={idx + 1} />
              ))}
              {holdings[row.ticker] === undefined && (
                <div className="px-4 py-3 text-zinc-600 text-[10px]">Loading holdings...</div>
              )}
              {holdings[row.ticker]?.length === 0 && (
                <div className="px-4 py-3 text-zinc-600 text-[10px]">No holdings data available.</div>
              )}
            </div>
          )}
        </div>
      ))}

      {sorted.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-zinc-600 text-xs gap-3">
          <div className="text-zinc-500">No ETF data available for this theme.</div>
          <div className="text-zinc-600 text-[10px]">RS data may still be loading. Theme: {themeName}</div>
        </div>
      )}
    </div>
  )
}
