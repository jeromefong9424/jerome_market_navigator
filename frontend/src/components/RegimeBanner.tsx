import { useEffect, useState } from 'react'
import { fetchRegime, type RegimeData } from '../api'

const REGIME_COLOR = {
  green: { dot: '#2ea043', bg: 'rgba(46,160,67,0.08)', border: 'rgba(46,160,67,0.2)', text: '#2ea043' },
  yellow: { dot: '#d29922', bg: 'rgba(210,153,34,0.08)', border: 'rgba(210,153,34,0.2)', text: '#d29922' },
  red: { dot: '#f85149', bg: 'rgba(248,81,73,0.08)', border: 'rgba(248,81,73,0.2)', text: '#f85149' },
} as const

function fmt(v: number | undefined, decimals = 2) {
  if (v === undefined) return '—'
  return v >= 0 ? `+${v.toFixed(decimals)}` : v.toFixed(decimals)
}

function Cell({ label, value, sub, positive }: {
  label: string
  value: string
  sub?: string
  positive?: boolean | null
}) {
  const valColor = positive === true ? 'text-emerald-400' : positive === false ? 'text-rose-400' : 'text-zinc-300'
  return (
    <div className="flex flex-col items-center px-3 py-2 min-w-0">
      <span className="text-[9px] uppercase tracking-widest text-zinc-600 mb-0.5 whitespace-nowrap">{label}</span>
      <span className={`text-sm font-semibold font-mono tabular-nums ${valColor}`}>{value}</span>
      {sub !== undefined && <span className="text-[9px] text-zinc-600 font-mono">{sub}</span>}
    </div>
  )
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
    <div
      className="flex items-center px-4 py-2 border-b border-white/5 gap-0"
      style={{ background: c.bg }}
    >
      {/* SPY */}
      <Cell
        label="SPY"
        value={fmt(data.spy.close)}
        sub={fmt(data.spy.distance_pct) + '%'}
        positive={data.spy.above}
      />

      {/* Divider */}
      <div className="w-px h-8 bg-white/5 flex-shrink-0" />

      {/* QQQ */}
      <Cell
        label="QQQ"
        value={fmt(data.qqq.close)}
        sub={fmt(data.qqq.distance_pct) + '%'}
        positive={data.qqq.above}
      />

      <div className="w-px h-8 bg-white/5 flex-shrink-0" />

      {/* IWM/QQQ */}
      <Cell
        label="IWM/QQQ"
        value={fmt(data.iwm_qqq.ratio, 4)}
        sub={fmt(data.iwm_qqq.ratio_5d_change) + '%'}
        positive={data.iwm_qqq.risk_on}
      />

      <div className="w-px h-8 bg-white/5 flex-shrink-0" />

      {/* IBIT */}
      <Cell
        label="IBIT"
        value={fmt(data.ibit.close)}
        sub={fmt(data.ibit.distance_pct) + '%'}
        positive={data.ibit.above}
      />

      {/* Spacer */}
      <div className="flex-1" />

      {/* Regime badge */}
      <div
        className="flex items-center gap-2 px-3 py-1 rounded-md border flex-shrink-0"
        style={{ borderColor: c.border, background: 'rgba(0,0,0,0.2)' }}
      >
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ background: c.dot }}
        />
        <span className="text-xs font-semibold" style={{ color: c.text }}>
          {data.regime.toUpperCase()}
        </span>
        <span className="text-[10px] text-zinc-500 hidden sm:block">{data.label}</span>
      </div>
    </div>
  )
}