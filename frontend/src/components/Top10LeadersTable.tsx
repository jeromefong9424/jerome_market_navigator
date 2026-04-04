import { useState, useEffect, useRef, useCallback } from 'react'
import { createChart, ColorType, CrosshairMode, CandlestickSeries, LineSeries, HistogramSeries } from 'lightweight-charts'
import { AlertCircle } from 'lucide-react'
import { fetchThemeLeaders, type ThemeLeader, type ThemeLeadersResponse } from '../api'

function LeaderChart({ leader }: { leader: ThemeLeader }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seriesRef = useRef<{ candle: any; ema8: any; ema21: any; ema50: any; vol: any } | null>(null)

  useEffect(() => {
    if (!containerRef.current || !leader.ohlcv?.length) return

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 220,
      layout: {
        background: { type: ColorType.Solid, color: '#0d1117' },
        textColor: '#6e7681',
      },
      grid: { vertLines: { visible: false }, horzLines: { visible: false } },
      crosshair: { mode: CrosshairMode.Hidden },
      rightPriceScale: { visible: false },
      leftPriceScale: { visible: false },
      timeScale: { visible: true, borderVisible: false, timeVisible: false },
      handleScroll: false,
      handleScale: false,
    })

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#2ea043', downColor: '#f85149',
      borderUpColor: '#2ea043', borderDownColor: '#f85149',
      wickUpColor: '#2ea043', wickDownColor: '#f85149',
    })

    const ema8Series = chart.addSeries(LineSeries, {
      color: '#58a6ff', lineWidth: 1,
    })
    const ema21Series = chart.addSeries(LineSeries, {
      color: '#f0883e', lineWidth: 1,
    })
    const ema50Series = chart.addSeries(LineSeries, {
      color: '#f85149', lineWidth: 1,
    })
    const volSeries = chart.addSeries(HistogramSeries, {
      color: '#26a641',
      priceFormat: { type: 'volume' },
      priceScaleId: 'vol',
    })
    chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } })

    chartRef.current = chart
    seriesRef.current = {
      candle: candleSeries,
      ema8: ema8Series,
      ema21: ema21Series,
      ema50: ema50Series,
      vol: volSeries,
    }

    const ro = new ResizeObserver(() => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth })
    })
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
    }
  }, [leader])

  useEffect(() => {
    if (!seriesRef.current || !leader.ohlcv?.length) return

    const { candle, ema8, ema21, ema50, vol } = seriesRef.current

    candle.setData(leader.ohlcv)

    // Compute EMAs
    const closes = leader.ohlcv.map(c => c.close)
    const times = leader.ohlcv.map(c => c.time)

    function computeEma(data: number[], n: number) {
      const alpha = 2 / (n + 1)
      const result: { time: string; value: number }[] = []
      let ema = data.slice(0, n).reduce((a, b) => a + b, 0) / n
      for (let i = n - 1; i < data.length; i++) {
        ema = alpha * data[i] + (1 - alpha) * ema
        if (i >= n - 1) {
          result.push({ time: times[i], value: ema })
        }
      }
      return result
    }

    const ema8Data = computeEma(closes, 8)
    const ema21Data = computeEma(closes, 21)
    const ema50Data = computeEma(closes, 50)

    ema8.setData(ema8Data)
    ema21.setData(ema21Data)
    ema50.setData(ema50Data)

    // Volume bars
    const volData = leader.ohlcv.map(c => ({
      time: c.time,
      value: c.volume,
      color: c.close >= c.open ? 'rgba(46,160,67,0.4)' : 'rgba(248,81,73,0.4)',
    }))
    vol.setData(volData)

    // 52-week high line
    chartRef.current?.timeScale().fitContent()
  }, [leader])

  return (
    <div className="mt-3">
      <div className="text-[10px] text-zinc-600 mb-1">
        {leader.ticker} — RS: {leader.rs_slope >= 0 ? '+' : ''}{leader.rs_slope.toFixed(3)} — ATR: {leader.atr_contraction.toFixed(2)}x
      </div>
      <div ref={containerRef} className="w-full" />
    </div>
  )
}

export default function Top10LeadersTable({ themeId }: { themeId: string; themeName?: string }) {
  const [data, setData] = useState<ThemeLeadersResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [hoveredTicker, setHoveredTicker] = useState<string | null>(null)
  const [preloaded, setPreloaded] = useState<Record<string, ThemeLeader>>({})
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fetch all leaders immediately
  useEffect(() => {
    setLoading(true)
    setData(null)
    setPreloaded({})
    setHoveredTicker(null)

    fetchThemeLeaders(themeId)
      .then(res => {
        setData(res)
        // Preload into memory map
        const map: Record<string, ThemeLeader> = {}
        for (const l of res.leaders) map[l.ticker] = l
        setPreloaded(map)
        if (res.leaders.length > 0) setHoveredTicker(res.leaders[0].ticker)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [themeId])

  const handleHover = useCallback((ticker: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setHoveredTicker(ticker)
    }, 150)
  }, [])

  const handleLeave = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
  }, [])

  const hoveredLeader = hoveredTicker ? (preloaded[hoveredTicker] ?? null) : null

  if (loading) {
    return (
      <div className="flex flex-col gap-2 p-4">
        <div className="shimmer-line h-4 w-40 rounded" />
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="shimmer-line h-8 rounded" />
        ))}
      </div>
    )
  }

  if (!data || data.leaders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-zinc-600 text-xs">
        No leader data available for this theme.
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-white/5">
              {['#', 'Ticker', 'RS Slope', '8EMA', '21EMA', '50EMA', '1W%', '1M%', '52w Hi%', 'ATR C.', 'Vol.'].map(h => (
                <th key={h} className="px-2 py-2 text-left text-[9px] uppercase tracking-widest text-zinc-600 font-semibold whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.leaders.map(leader => {
              const isHov = hoveredTicker === leader.ticker
              return (
                <tr
                  key={leader.ticker}
                  className={`border-b border-white/[0.03] cursor-pointer transition-colors ${
                    isHov ? 'bg-[#1c2129]' : 'hover:bg-[#161b22]'
                  }`}
                  onMouseEnter={() => handleHover(leader.ticker)}
                  onMouseLeave={handleLeave}
                >
                  {/* Rank */}
                  <td className="px-2 py-2 text-zinc-600 font-mono">
                    {leader.rank <= 2 ? (
                      <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-[#1c3a5f] text-[#58a6ff] text-[9px] font-bold mr-1">
                        {leader.rank}
                      </span>
                    ) : (
                      <span className="text-zinc-600 font-mono">{leader.rank}</span>
                    )}
                  </td>

                  {/* Ticker */}
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-zinc-200">{leader.ticker}</span>
                      {leader.rank <= 2 && (
                        <span className="text-[7px] bg-[#1c3a5f] text-[#58a6ff] px-1 py-0.5 rounded font-semibold">
                          LEADER
                        </span>
                      )}
                      {leader.is_gap && (
                        <span className="flex items-center gap-0.5 text-[7px] text-amber-400 border border-amber-500/30 px-1 py-0.5 rounded">
                          <AlertCircle size={7} /> NO ETF
                        </span>
                      )}
                    </div>
                    {leader.gap_branch && (
                      <div className="text-[9px] text-zinc-600 mt-0.5">{leader.gap_branch}</div>
                    )}
                  </td>

                  {/* RS Slope */}
                  <td className="px-2 py-2 font-mono tabular-nums"
                    style={{ color: leader.rs_slope >= 0 ? '#2ea043' : '#f85149' }}>
                    {leader.rs_slope >= 0 ? '+' : ''}{leader.rs_slope.toFixed(3)}
                  </td>

                  {/* 8 EMA */}
                  <td className="px-2 py-2 font-mono text-[10px]" style={{ color: leader.above_ema8 ? '#2ea043' : '#f85149' }}>
                    {leader.ema8 ? `$${leader.ema8.toFixed(2)}` : '—'}
                  </td>

                  {/* 21 EMA */}
                  <td className="px-2 py-2 font-mono text-[10px]" style={{ color: leader.above_ema21 ? '#2ea043' : '#f85149' }}>
                    {leader.ema21 ? `$${leader.ema21.toFixed(2)}` : '—'}
                  </td>

                  {/* 50 EMA */}
                  <td className="px-2 py-2 font-mono text-[10px]" style={{ color: leader.above_ema50 === null ? '#6e7681' : leader.above_ema50 ? '#2ea043' : '#f85149' }}>
                    {leader.ema50 ? `$${leader.ema50.toFixed(2)}` : '—'}
                  </td>

                  {/* 1W% */}
                  <td className="px-2 py-2 font-mono tabular-nums text-[10px]" style={{ color: leader.pct_1w !== null && leader.pct_1w >= 0 ? '#2ea043' : '#f85149' }}>
                    {leader.pct_1w != null ? `${leader.pct_1w >= 0 ? '+' : ''}${leader.pct_1w.toFixed(1)}%` : '—'}
                  </td>

                  {/* 1M% */}
                  <td className="px-2 py-2 font-mono tabular-nums text-[10px]" style={{ color: leader.pct_1m !== null && leader.pct_1m >= 0 ? '#2ea043' : '#f85149' }}>
                    {leader.pct_1m != null ? `${leader.pct_1m >= 0 ? '+' : ''}${leader.pct_1m.toFixed(1)}%` : '—'}
                  </td>

                  {/* 52w Hi */}
                  <td className="px-2 py-2 font-mono tabular-nums text-[10px]" style={{ color: leader.pct_from_high >= -5 ? '#2ea043' : '#f85149' }}>
                    {leader.pct_from_high.toFixed(1)}%
                  </td>

                  {/* ATR Contraction */}
                  <td className="px-2 py-2 font-mono tabular-nums text-[10px]" style={{ color: leader.atr_contraction < 0.7 ? '#2ea043' : '#6e7681' }}>
                    {leader.atr_contraction.toFixed(3)}
                  </td>

                  {/* Vol dry-up */}
                  <td className="px-2 py-2 font-mono tabular-nums text-[10px]" style={{ color: leader.vol_ratio < 0.6 ? '#2ea043' : '#6e7681' }}>
                    {leader.vol_ratio.toFixed(3)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Hover chart */}
      {hoveredLeader && (
        <div className="p-4 border-t border-white/5">
          <LeaderChart leader={hoveredLeader} />
        </div>
      )}
    </div>
  )
}