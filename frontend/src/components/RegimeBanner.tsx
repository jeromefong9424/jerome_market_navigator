import { useEffect, useState } from 'react'
import { fetchRegime, type RegimeData } from '../api'

function RibbonCard({
  label,
  value,
  delta,
  subtext,
  tone,
  highlight = false,
}: {
  label: string
  value: string
  delta: string
  subtext?: string
  tone: 'up' | 'down' | 'neutral'
  highlight?: boolean
}) {
  const toneColor = tone === 'up' ? 'var(--up)' : tone === 'down' ? 'var(--down)' : 'var(--muted)'
  return (
    <div
      className="px-3.5 py-3 rounded-xl border"
      style={{
        background: 'var(--panel)',
        borderColor: highlight ? 'rgba(57,214,123,0.2)' : 'var(--line)',
      }}
    >
      <div className="font-mono text-[10px] tracking-[0.16em] uppercase" style={{ color: 'var(--muted-2)' }}>
        {label}
      </div>
      <div className="font-mono text-[17px] font-semibold mt-1 tabular-nums" style={{ color: 'var(--text)' }}>
        {value}
      </div>
      <div className="font-mono text-[11px] mt-0.5 tabular-nums" style={{ color: toneColor }}>
        {delta}
        {subtext && <span style={{ color: 'var(--muted-2)' }}> · {subtext}</span>}
      </div>
    </div>
  )
}

function fmtPct(v: number | undefined): string {
  if (v === undefined || isNaN(v)) return '—'
  return v >= 0 ? `+${v.toFixed(2)}%` : `${v.toFixed(2)}%`
}

export default function RegimeBanner() {
  const [data, setData] = useState<RegimeData | null>(null)
  const [wti, setWti] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchRegime()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetch('https://query1.finance.yahoo.com/v8/finance/chart/CL=F?interval=1d&range=5d')
      .then(r => r.json())
      .then(d => {
        const meta = d?.chart?.result?.[0]?.meta
        if (meta?.regularMarketPrice) setWti(meta.regularMarketPrice)
      })
      .catch(() => {})
  }, [])

  if (loading || !data) {
    return (
      <div className="grid grid-cols-5 gap-2.5 px-5 py-3 border-b" style={{ borderColor: 'var(--line)' }}>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="h-[70px] shimmer-line rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div
      className="grid grid-cols-5 max-md:grid-cols-2 gap-2.5 px-5 py-3 border-b"
      style={{ borderColor: 'var(--line)' }}
    >
      <RibbonCard
        label="SPY"
        value={`$${data.spy.close.toFixed(2)}`}
        delta={fmtPct(data.spy.distance_pct)}
        subtext={data.spy.above ? 'above 8EMA' : 'below 8EMA'}
        tone={data.spy.above ? 'up' : 'down'}
        highlight
      />
      <RibbonCard
        label="QQQ"
        value={`$${data.qqq.close.toFixed(2)}`}
        delta={fmtPct(data.qqq.distance_pct)}
        subtext={data.qqq.above ? 'above 8EMA' : 'below 8EMA'}
        tone={data.qqq.above ? 'up' : 'down'}
      />
      <RibbonCard
        label="IWM/QQQ"
        value={data.iwm_qqq.ratio.toFixed(4)}
        delta={fmtPct(data.iwm_qqq.ratio_5d_change)}
        subtext="5d"
        tone={data.iwm_qqq.risk_on ? 'up' : 'down'}
      />
      <RibbonCard
        label="IBIT"
        value={`$${data.ibit.close.toFixed(2)}`}
        delta={fmtPct(data.ibit.distance_pct)}
        subtext={data.ibit.above ? 'above 50SMA' : 'below 50SMA'}
        tone={data.ibit.above ? 'up' : 'down'}
      />
      <RibbonCard
        label="WTI"
        value={wti !== null ? `$${wti.toFixed(2)}` : '—'}
        delta={wti !== null ? '' : '—'}
        tone="neutral"
      />
    </div>
  )
}
