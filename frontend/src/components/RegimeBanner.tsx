import { useEffect, useState } from 'react'
import { fetchRegime, type RegimeData } from '../api'

const REGIME_COLOR = {
  green: { dot: '#2ea043', bg: 'rgba(46,160,67,0.08)', border: 'rgba(46,160,67,0.2)', text: '#2ea043' },
  yellow: { dot: '#d29922', bg: 'rgba(210,153,34,0.08)', border: 'rgba(210,153,34,0.2)', text: '#d29922' },
  red: { dot: '#f85149', bg: 'rgba(248,81,73,0.08)', border: 'rgba(248,81,73,0.2)', text: '#f85149' },
} as const

function fmt(v: number | undefined, decimals = 2) {
  if (v === undefined || isNaN(v as number)) return '—'
  return v >= 0 ? `+${(v as number).toFixed(decimals)}` : (v as number).toFixed(decimals)
}

function pct(v: number | undefined, decimals = 2) {
  if (v === undefined || isNaN(v)) return '—'
  return v >= 0 ? `+${v.toFixed(decimals)}%` : `${v.toFixed(decimals)}%`
}

export default function RegimeBanner() {
  const [data, setData] = useState<RegimeData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchRegime()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading || !data) {
    return (
      <div className="flex items-center gap-4 px-4 py-2 border-b border-white/5 bg-black/20">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="h-8 w-24 shimmer-line rounded" />
        ))}
      </div>
    )
  }

  const c = REGIME_COLOR[data.regime]

  return (
    <div className="border-b border-white/5" style={{ background: c.bg }}>
      {/* Row 1: primary metrics + regime */}
      <div className="flex items-center px-4 py-2 gap-0">
        {/* SPY */}
        <div className="flex flex-col items-center px-3 min-w-0">
          <span className="text-[9px] uppercase tracking-widest text-zinc-600 mb-0.5">SPY</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-semibold font-mono text-zinc-200">${data.spy.close.toFixed(2)}</span>
            <span className={`text-[10px] font-mono ${data.spy.above ? 'text-emerald-400' : 'text-rose-400'}`}>
              {fmt(data.spy.distance_pct)}%
            </span>
          </div>
          <span className="text-[8px] text-zinc-700 mt-0.5">EMA8 {fmt(data.spy.ema8)}</span>
        </div>

        <div className="w-px h-10 bg-white/5 flex-shrink-0 mx-1" />

        {/* QQQ */}
        <div className="flex flex-col items-center px-3 min-w-0">
          <span className="text-[9px] uppercase tracking-widest text-zinc-600 mb-0.5">QQQ</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-semibold font-mono text-zinc-200">${data.qqq.close.toFixed(2)}</span>
            <span className={`text-[10px] font-mono ${data.qqq.above ? 'text-emerald-400' : 'text-rose-400'}`}>
              {fmt(data.qqq.distance_pct)}%
            </span>
          </div>
          <span className="text-[8px] text-zinc-700 mt-0.5">EMA8 {fmt(data.qqq.ema8)}</span>
        </div>

        <div className="w-px h-10 bg-white/5 flex-shrink-0 mx-1" />

        {/* IWM/QQQ */}
        <div className="flex flex-col items-center px-3 min-w-0">
          <span className="text-[9px] uppercase tracking-widest text-zinc-600 mb-0.5">IWM/QQQ</span>
          <span className="text-sm font-mono text-zinc-200">{fmt(data.iwm_qqq.ratio, 4)}</span>
          <span className={`text-[10px] font-mono mt-0.5 ${data.iwm_qqq.risk_on ? 'text-emerald-400' : 'text-rose-400'}`}>
            {pct(data.iwm_qqq.ratio_5d_change)}
          </span>
        </div>

        <div className="w-px h-10 bg-white/5 flex-shrink-0 mx-1" />

        {/* IBIT */}
        <div className="flex flex-col items-center px-3 min-w-0">
          <span className="text-[9px] uppercase tracking-widest text-zinc-600 mb-0.5">IBIT</span>
          <div className="flex items-baseline gap-1">
            <span className="text-sm font-mono text-zinc-200">${data.ibit.close.toFixed(2)}</span>
            <span className={`text-[10px] font-mono ${data.ibit.above ? 'text-emerald-400' : 'text-rose-400'}`}>
              {fmt(data.ibit.distance_pct)}%
            </span>
          </div>
          <span className="text-[8px] text-zinc-700 mt-0.5">SMA50 {fmt(data.ibit.sma50)}</span>
        </div>

        <div className="flex-1" />

        {/* Regime badge */}
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-md border flex-shrink-0"
          style={{ borderColor: c.border, background: 'rgba(0,0,0,0.2)' }}
        >
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.dot }} />
          <span className="text-xs font-bold" style={{ color: c.text }}>{data.regime.toUpperCase()}</span>
          <span className="text-[10px] text-zinc-500 hidden md:block">{data.label}</span>
        </div>
      </div>

      {/* Row 2: performance metrics */}
      <div className="flex items-center px-4 py-1.5 border-t border-white/5 gap-0 overflow-x-auto scrollbar-none">
        {/* SPY perf */}
        <div className="flex items-center gap-3 pr-4 min-w-0">
          <span className="text-[8px] uppercase tracking-widest text-zinc-700">SPY</span>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-zinc-600">1W</span>
            <span className="text-[10px] font-mono text-zinc-300">{pct(data.spy.pct_1w)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-zinc-600">1M</span>
            <span className="text-[10px] font-mono text-zinc-300">{pct(data.spy.pct_1m)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-zinc-600">YTD</span>
            <span className={`text-[10px] font-mono ${data.spy.ytd_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{pct(data.spy.ytd_pct)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-zinc-600">52w</span>
            <span className={`text-[10px] font-mono ${data.spy.from_high_pct >= -5 ? 'text-emerald-400' : data.spy.from_high_pct >= -15 ? 'text-amber-400' : 'text-rose-400'}`}>
              {pct(data.spy.from_high_pct)}
            </span>
          </div>
        </div>

        <div className="w-px h-4 bg-white/5 flex-shrink-0 mx-3" />

        {/* QQQ perf */}
        <div className="flex items-center gap-3 pr-4 min-w-0">
          <span className="text-[8px] uppercase tracking-widest text-zinc-700">QQQ</span>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-zinc-600">1W</span>
            <span className="text-[10px] font-mono text-zinc-300">{pct(data.qqq.pct_1w)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-zinc-600">1M</span>
            <span className="text-[10px] font-mono text-zinc-300">{pct(data.qqq.pct_1m)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-zinc-600">YTD</span>
            <span className={`text-[10px] font-mono ${data.qqq.ytd_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{pct(data.qqq.ytd_pct)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-zinc-600">52w</span>
            <span className={`text-[10px] font-mono ${data.qqq.from_high_pct >= -5 ? 'text-emerald-400' : data.qqq.from_high_pct >= -15 ? 'text-amber-400' : 'text-rose-400'}`}>
              {pct(data.qqq.from_high_pct)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}