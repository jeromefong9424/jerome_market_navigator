import { useState, useEffect, useRef } from 'react'
import { createChart, ColorType, CrosshairMode, CandlestickSeries, HistogramSeries } from 'lightweight-charts'
import * as HoverCard from '@radix-ui/react-hover-card'
import { fetchRS, fetchHoldings } from '../api'
import { quadrant, QUAD_COLOR, QUAD_LABEL, QUAD_BG } from '../lib/quadrant'
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

interface HoldingRow {
  ticker: string
  rs_slope: number
  pct_1w: number | null
  pct_1m: number | null
  from_high_pct: number
  price: number
}

// ── TradingView iframe — UNCHANGED per handoff spec ────────────────────────────
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

// ── Mini candle chart for hover card ───────────────────────────────────────────
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
        color: c.close >= c.open ? 'rgba(57,214,123,0.4)' : 'rgba(255,94,122,0.4)',
      })))
      chartRef.current?.timeScale().fitContent()
    }).catch(() => {})

    return () => { ro.disconnect(); chart.remove(); chartRef.current = null }
  }, [ticker])

  return <div ref={ref} className="w-full" />
}

// ── Holding row ────────────────────────────────────────────────────────────────
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
      className="grid items-center gap-2 px-4 py-2 text-[11px] font-mono tabular-nums border-b"
      style={{ borderColor: 'var(--line)', gridTemplateColumns: '28px 1fr 72px 72px 72px 72px' }}
    >
      <span style={{ color: 'var(--muted-2)' }}>{rank}</span>
      <HoverCard.Root>
        <HoverCard.Trigger asChild>
          <span
            className="font-semibold cursor-pointer transition-colors hover:opacity-80"
            style={{ color: 'var(--text)' }}
          >
            {ticker}
          </span>
        </HoverCard.Trigger>
        <HoverCard.Portal>
          <HoverCard.Content
            className="rounded-xl border shadow-2xl overflow-hidden z-50"
            sideOffset={4}
            style={{ width: 300, background: '#0b0f1a', borderColor: 'var(--line-2)' }}
          >
            <div
              className="px-3 py-2 border-b flex items-center justify-between"
              style={{ borderColor: 'var(--line)' }}
            >
              <span className="text-[11px] font-bold" style={{ color: 'var(--text)' }}>{ticker}</span>
              <span className="text-[9px]" style={{ color: 'var(--muted-2)' }}>3mo · daily</span>
            </div>
            <MiniChart ticker={ticker} />
            <HoverCard.Arrow style={{ fill: 'var(--line-2)' }} />
          </HoverCard.Content>
        </HoverCard.Portal>
      </HoverCard.Root>
      {data ? (
        <>
          <span style={{ color: (data.pct_1w ?? 0) >= 0 ? 'var(--up)' : 'var(--down)' }}>
            {data.pct_1w != null ? `${data.pct_1w >= 0 ? '+' : ''}${data.pct_1w.toFixed(1)}%` : '—'}
          </span>
          <span style={{ color: (data.pct_1m ?? 0) >= 0 ? 'var(--up)' : 'var(--down)' }}>
            {data.pct_1m != null ? `${data.pct_1m >= 0 ? '+' : ''}${data.pct_1m.toFixed(1)}%` : '—'}
          </span>
          <span style={{ color: data.from_high_pct >= -5 ? 'var(--up)' : 'var(--down)' }}>
            {data.from_high_pct.toFixed(1)}%
          </span>
          <span style={{ color: 'var(--muted)' }}>${data.price.toFixed(2)}</span>
        </>
      ) : (
        <>
          <span style={{ color: 'var(--muted-2)' }}>—</span>
          <span style={{ color: 'var(--muted-2)' }}>—</span>
          <span style={{ color: 'var(--muted-2)' }}>—</span>
          <span style={{ color: 'var(--muted-2)' }}>—</span>
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

  const quad = rsData ? quadrant(rsData.rs_strength, rsData.rs_momentum) : 'lagging'
  const quadColor = QUAD_COLOR[quad]

  const stats = rsData ? [
    { label: '1W', value: rsData.pct_1w, tone: (rsData.pct_1w ?? 0) >= 0 ? 'up' : 'down', suffix: '%' },
    { label: '1M', value: rsData.pct_1m, tone: (rsData.pct_1m ?? 0) >= 0 ? 'up' : 'down', suffix: '%' },
    { label: 'YTD', value: rsData.ytd_pct, tone: (rsData.ytd_pct ?? 0) >= 0 ? 'up' : 'down', suffix: '%' },
    { label: '52W HI', value: rsData.from_high_pct, tone: (rsData.from_high_pct ?? 0) >= -5 ? 'up' : 'down', suffix: '%' },
    { label: 'RS STR', value: rsData.rs_strength, tone: 'neutral', suffix: '' },
  ] : []

  return (
    <div className="flex flex-col px-5 py-4 gap-4">
      {/* Back button */}
      <button
        onClick={onBack}
        className="self-start flex items-center gap-1.5 text-[11px] font-medium transition-colors px-2.5 h-7 rounded-[8px] border"
        style={{ borderColor: 'var(--line)', color: 'var(--muted)', background: 'var(--panel)' }}
      >
        ← Back
      </button>

      {/* Hero card */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}
      >
        <div className="grid grid-cols-[1fr_auto] gap-6 p-5 max-md:grid-cols-1">
          {/* Left — identity + stats */}
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[28px] font-bold tracking-tight" style={{ color: 'var(--text)' }}>
                {ticker}
              </span>
              {rsData && (
                <span
                  className="font-mono text-[10px] font-semibold tracking-[0.1em] px-2 py-1 rounded-[6px]"
                  style={{ background: QUAD_BG[quad], color: quadColor }}
                >
                  {QUAD_LABEL[quad]}
                </span>
              )}
              {rsData && rsData.price !== undefined && (
                <span className="font-mono text-[16px] font-semibold tabular-nums" style={{ color: 'var(--text)' }}>
                  ${rsData.price.toFixed(2)}
                </span>
              )}
            </div>

            {/* 5-stat row */}
            {rsData && (
              <div className="grid grid-cols-5 gap-3 mt-5 max-md:grid-cols-3">
                {stats.map(s => {
                  const toneColor = s.tone === 'up' ? 'var(--up)' : s.tone === 'down' ? 'var(--down)' : 'var(--muted)'
                  return (
                    <div key={s.label}>
                      <div className="font-mono text-[9px] tracking-[0.15em] uppercase" style={{ color: 'var(--muted-2)' }}>
                        {s.label}
                      </div>
                      <div
                        className="font-mono text-[14px] font-semibold tabular-nums mt-1"
                        style={{ color: toneColor }}
                      >
                        {s.value != null ? `${s.value >= 0 ? '+' : ''}${s.value.toFixed(1)}${s.suffix}` : '—'}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Right — RS sparkline + slope caption */}
          {rsData && rsData.rs_norm && rsData.rs_norm.length > 0 && (
            <div className="flex flex-col items-end justify-center gap-1">
              <Sparkline values={rsData.rs_norm} color={quadColor} width={160} height={50} strokeWidth={2} />
              <div className="font-mono text-[10px] tracking-[0.1em]" style={{ color: 'var(--muted-2)' }}>
                <span style={{ color: 'var(--muted)' }}>slope </span>
                <span style={{ color: rsData.rs_slope >= 0 ? 'var(--up)' : 'var(--down)' }}>
                  {rsData.rs_slope >= 0 ? '+' : ''}{rsData.rs_slope.toFixed(3)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Price action panel — wraps TradingView iframe, iframe itself untouched */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}
      >
        <div
          className="flex items-center justify-between px-4 py-2.5 border-b"
          style={{ borderColor: 'var(--line)' }}
        >
          <span className="text-[12px] font-semibold" style={{ color: 'var(--text)' }}>
            Price action
          </span>
          <span className="font-mono text-[10px] tracking-[0.15em] uppercase" style={{ color: 'var(--muted-2)' }}>
            Daily · TradingView
          </span>
        </div>
        <div style={{ height: 460 }}>
          <ETFDashboardChart ticker={ticker} />
        </div>
      </div>

      {/* Holdings panel */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}
      >
        <div
          className="flex items-center justify-between px-4 py-2.5 border-b"
          style={{ borderColor: 'var(--line)' }}
        >
          <span className="text-[12px] font-semibold" style={{ color: 'var(--text)' }}>
            Top Holdings
          </span>
          <span className="font-mono text-[10px] tracking-[0.15em] uppercase" style={{ color: 'var(--muted-2)' }}>
            {ticker}
          </span>
        </div>
        <div
          className="grid items-center gap-2 px-4 py-2 font-mono text-[9px] uppercase tracking-[0.12em] font-semibold border-b"
          style={{ borderColor: 'var(--line)', gridTemplateColumns: '28px 1fr 72px 72px 72px 72px', color: 'var(--muted-2)' }}
        >
          <span>#</span>
          <span>HOLDING</span>
          <span>1W</span>
          <span>1M</span>
          <span>52W</span>
          <span>PRICE</span>
        </div>
        {holdings.slice(0, 10).map((t, i) => (
          <HoldingRow key={t} ticker={t} rank={i + 1} />
        ))}
        {holdings.length === 0 && (
          <div className="px-4 py-6 text-[10px]" style={{ color: 'var(--muted-2)' }}>Loading holdings…</div>
        )}
      </div>
    </div>
  )
}
