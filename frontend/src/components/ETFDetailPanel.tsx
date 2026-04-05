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

interface HoldingRow {
  ticker: string
  rs_slope: number
  pct_1w: number | null
  pct_1m: number | null
  from_high_pct: number
  price: number
}

function ETFDashboardChart({ ticker }: { ticker: string }) {
  const src = `https://s.tradingview.com/widgetembed/?symbol=${encodeURIComponent(ticker)}&interval=D&hideideas=1&theme=dark&style=1&locale=en&allow_symbol_change=1&save_image=0`

  return (
    <iframe
      key={ticker}
      src={src}
      style={{ width: '100%', height: 460, border: 'none' }}
      allowTransparency
    />
  )
}


// ─── Mini candlestick chart for hover card ────────────────────────────────────
function MiniChart({ ticker }: { ticker: string }) {
  const ref = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartRef = useRef<any>(null)

  useEffect(() => {
    if (!ref.current) return
    if (chartRef.current) {
      chartRef.current.remove()
      chartRef.current = null
    }
    const chart = createChart(ref.current, {
      width: ref.current.clientWidth || 280,
      height: 140,
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

    const ro = new ResizeObserver(() => {
      if (ref.current && chartRef.current) chartRef.current.applyOptions({ width: ref.current.clientWidth })
    })
    if (ref.current) ro.observe(ref.current)

    fetchRS([ticker]).then((data: unknown) => {
      const rows = data as RSData[]
      const row = rows[0]
      if (!row?.candles?.length) return
      candle.setData(row.candles)
      vol.setData(row.candles.map((c: { time: string; open: number; high: number; low: number; close: number; volume?: number }) => ({
        time: c.time,
        value: c.volume ?? 0,
        color: c.close >= c.open ? 'rgba(46,160,67,0.4)' : 'rgba(248,81,73,0.4)',
      })))
      chartRef.current?.timeScale().fitContent()
    }).catch(() => {})

    return () => { ro.disconnect(); chart.remove(); chartRef.current = null }
  }, [ticker])

  return <div ref={ref} className="w-full" />
}

function HoldingRow({ ticker, rank }: { ticker: string; rank: number }) {
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
      className="grid items-center gap-2 px-4 py-1.5 border-b border-white/[0.03] hover:bg-[#161b22] transition-colors text-[10px]"
      style={{ gridTemplateColumns: '24px 1fr 60px 60px 60px 60px' }}
    >
      <span className="text-zinc-600">{rank}</span>
      <HoverCard.Root>
        <HoverCard.Trigger asChild>
          <span className="font-bold text-zinc-200 cursor-pointer hover:text-[#58a6ff] transition-colors">{ticker}</span>
        </HoverCard.Trigger>
        <HoverCard.Portal>
          <HoverCard.Content
            className="rounded-xl border border-[#2A2A2A] bg-[#0D0D0D] shadow-2xl overflow-hidden z-50"
            sideOffset={4}
            style={{ width: 300 }}
          >
            <div className="px-3 py-2 border-b border-[#1A1A1A] flex items-center justify-between">
              <span className="text-white text-[11px] font-bold">{ticker}</span>
              <span className="text-zinc-600 text-[9px]">3mo · daily</span>
            </div>
            <MiniChart ticker={ticker} />
            <HoverCard.Arrow className="fill-[#2A2A2A]" />
          </HoverCard.Content>
        </HoverCard.Portal>
      </HoverCard.Root>
      {data ? (
        <>
          <span className="font-mono" style={{ color: (data.pct_1w ?? 0) >= 0 ? '#2ea043' : '#f85149' }}>
            {data.pct_1w != null ? `${data.pct_1w >= 0 ? '+' : ''}${data.pct_1w.toFixed(1)}%` : '—'}
          </span>
          <span className="font-mono" style={{ color: (data.pct_1m ?? 0) >= 0 ? '#2ea043' : '#f85149' }}>
            {data.pct_1m != null ? `${data.pct_1m >= 0 ? '+' : ''}${data.pct_1m.toFixed(1)}%` : '—'}
          </span>
          <span className="font-mono" style={{ color: data.from_high_pct >= -5 ? '#2ea043' : '#f85149' }}>
            {data.from_high_pct.toFixed(1)}%
          </span>
          <span className="font-mono text-zinc-400">${data.price.toFixed(2)}</span>
        </>
      ) : (
        <>
          <span className="text-zinc-600">—</span>
          <span className="text-zinc-600">—</span>
          <span className="text-zinc-600">—</span>
          <span className="text-zinc-600">—</span>
        </>
      )}
    </div>
  )
}

interface ETFDetailPanelProps {
  ticker: string
  onBack: () => void
}

export default function ETFDetailPanel({ ticker, onBack }: ETFDetailPanelProps) {
  const [rsData, setRsData] = useState<RSData | null>(null)
  const [holdings, setHoldings] = useState<string[]>([])

  useEffect(() => {
    fetchRS([ticker])
      .then((data: unknown) => {
        const rows = data as RSData[]
        setRsData(rows[0] ?? null)
      })
      .catch(() => {})
    fetchHoldings([ticker])
      .then((h: unknown) => {
        setHoldings((h as Record<string, string[]>)[ticker] ?? [])
      })
      .catch(() => {})
  }, [ticker])

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-white/5 px-4 py-2 flex items-center gap-3">
        <button
          onClick={onBack}
          className="text-[10px] text-zinc-600 hover:text-zinc-300 transition-colors border border-white/10 px-2 py-1 rounded"
        >
          ← Back
        </button>
        <span className="text-[13px] font-bold text-zinc-200">{ticker}</span>
        {rsData && (
          <span className="text-[11px] font-mono text-zinc-500">${rsData.price?.toFixed(2)}</span>
        )}
        {rsData && (
          <span className="text-[11px] font-mono font-semibold" style={{ color: rsData.rs_slope >= 0 ? '#2ea043' : '#f85149' }}>
            RS: {rsData.rs_slope >= 0 ? '+' : ''}{rsData.rs_slope.toFixed(3)}
          </span>
        )}
      </div>

      {/* Stats row */}
      {rsData && (
        <div className="flex-shrink-0 grid grid-cols-5 gap-0 border-b border-white/5">
          {[
            { label: '1W%', value: rsData.pct_1w, color: (rsData.pct_1w ?? 0) >= 0 ? '#2ea043' : '#f85149', suffix: '%' },
            { label: '1M%', value: rsData.pct_1m, color: (rsData.pct_1m ?? 0) >= 0 ? '#2ea043' : '#f85149', suffix: '%' },
            { label: 'YTD%', value: rsData.ytd_pct, color: (rsData.ytd_pct ?? 0) >= 0 ? '#2ea043' : '#f85149', suffix: '%' },
            { label: '52w Hi%', value: rsData.from_high_pct, color: (rsData.from_high_pct ?? 0) >= -5 ? '#2ea043' : '#f85149', suffix: '%' },
            { label: 'RS Strength', value: rsData.rs_strength, color: '#6e7681', suffix: '' },
          ].map(({ label, value, color, suffix }) => (
            <div key={label} className="flex flex-col items-center py-2 border-r border-white/[0.03] last:border-r-0">
              <span className="text-[8px] uppercase tracking-widest text-zinc-600">{label}</span>
              <span className="text-[12px] font-mono font-semibold" style={{ color }}>
                {value != null ? `${value >= 0 ? '+' : ''}${value.toFixed(1)}${suffix}` : '—'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Chart */}
      <div className="flex-shrink-0 px-2 pt-2" style={{ height: 460 }}>
        <ETFDashboardChart ticker={ticker} />
      </div>

      {/* Holdings */}
      <div className="flex-1 overflow-y-auto mt-2">
        <div className="px-4 py-1.5 text-[9px] uppercase tracking-widest text-zinc-600 font-semibold border-b border-white/[0.03]">
          Top Holdings — {ticker}
        </div>
        {/* Holdings header */}
        <div
          className="grid items-center gap-2 px-4 py-1.5 border-b border-white/[0.03] bg-[#161b22]/50 text-[9px] uppercase tracking-widest text-zinc-600 font-semibold"
          style={{ gridTemplateColumns: '24px 1fr 60px 60px 60px 60px' }}
        >
          <span>#</span>
          <span>Holding</span>
          <span>1W%</span>
          <span>1M%</span>
          <span>52w</span>
          <span>Price</span>
        </div>
        {holdings.slice(0, 10).map((t, i) => (
          <HoldingRow key={t} ticker={t} rank={i + 1} />
        ))}
        {holdings.length === 0 && (
          <div className="px-4 py-6 text-[10px] text-zinc-600">Loading holdings...</div>
        )}
      </div>
    </div>
  )
}
