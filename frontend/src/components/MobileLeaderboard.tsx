import { useState, useMemo } from 'react'
import themeGroups from '../config/themeGroups.json'
import { useStore } from '../store'
import { quadrant, type Quadrant, QUAD_COLOR, QUAD_BG } from '../lib/quadrant'
import { Sparkline } from './ui/Sparkline'

interface RSRow {
  ticker: string
  rs_slope: number
  rs_strength: number
  rs_momentum: number
  rs_norm?: number[]
  price?: number
  pct_1w?: number | null
  pct_1m?: number | null
  ytd_pct?: number | null
  from_high_pct?: number | null
}

const SHORT_LABEL: Record<Quadrant, string> = {
  leading:   'LEAD',
  improving: 'IMPR',
  weakening: 'WEAK',
  lagging:   'LAG',
}

interface MobileLeaderboardProps {
  rsData: RSRow[]
  onOpenBriefing: () => void
}

export default function MobileLeaderboard({ rsData, onOpenBriefing }: MobileLeaderboardProps) {
  const setSelectedTicker = useStore(s => s.setSelectedTicker)
  const [filter, setFilter] = useState<Quadrant | 'all'>('all')
  const [sortCol, setSortCol] = useState<'pct_1w' | 'pct_1m' | 'ytd_pct'>('pct_1w')

  // Build flat list of theme ETFs (not sector ETFs)
  const allETFs = useMemo(() => {
    const rsMap = new Map(rsData.map(r => [r.ticker, r]))
    const SECTOR = new Set(['XLK','XLE','XLF','XLV','XLI','XLY','XLP','XLU','XLB','XLRE','XLC'])
    const rows: (RSRow & { themeName: string; quad: Quadrant })[] = []
    for (const theme of themeGroups.themes) {
      for (const ticker of theme.etfs) {
        if (SECTOR.has(ticker)) continue
        const rs = rsMap.get(ticker)
        if (rs) rows.push({ ...rs, themeName: theme.name, quad: quadrant(rs.rs_strength, rs.rs_momentum) })
      }
    }
    return rows
  }, [rsData])

  // Counts per quadrant
  const counts = useMemo(() => {
    const c = { leading: 0, improving: 0, weakening: 0, lagging: 0 }
    for (const r of allETFs) c[r.quad]++
    return c
  }, [allETFs])

  // Filter + sort
  const filtered = filter === 'all' ? allETFs : allETFs.filter(r => r.quad === filter)
  const sorted = [...filtered].sort((a, b) => {
    const av = a[sortCol] ?? -999
    const bv = b[sortCol] ?? -999
    return bv - av // descending
  })

  const sortLabel = sortCol === 'pct_1w' ? '1W' : sortCol === 'pct_1m' ? '1M' : 'YTD'

  return (
    <div className="md:hidden flex flex-col w-full">
      {/* Today's briefing teaser card */}
      <div
        className="mx-4 mt-3 mb-4 p-3.5 rounded-[14px] cursor-pointer border"
        style={{
          background: 'linear-gradient(135deg, rgba(155,140,255,0.12), rgba(108,176,255,0.05))',
          borderColor: 'rgba(155,140,255,0.2)',
        }}
        onClick={onOpenBriefing}
      >
        <div
          className="font-mono text-[10px] tracking-[0.18em] uppercase"
          style={{ color: 'var(--leading)' }}
        >
          ● Today's briefing
        </div>
        <h3
          className="mt-1 text-[15px] font-semibold leading-[1.35]"
          style={{ color: 'var(--text)' }}
        >
          Tap to read full AI market briefing
        </h3>
        <div className="mt-2 font-mono text-[11px]" style={{ color: 'var(--leading)' }}>
          Read full briefing →
        </div>
      </div>

      {/* Page title + sort cycle */}
      <div className="flex items-baseline justify-between px-4 mb-2">
        <h2 className="text-[22px] font-bold tracking-tight" style={{ color: 'var(--text)' }}>
          Leaderboard
        </h2>
        <button
          onClick={() => setSortCol(c => c === 'pct_1w' ? 'pct_1m' : c === 'pct_1m' ? 'ytd_pct' : 'pct_1w')}
          className="font-mono text-[11px]"
          style={{ color: 'var(--muted)' }}
        >
          {sorted.length} · {sortLabel} ↓
        </button>
      </div>

      {/* Quadrant filter pills */}
      <div className="flex gap-1.5 px-4 mb-3 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setFilter('all')}
          className="flex-shrink-0 h-8 px-3 rounded-full text-[11px] font-medium border whitespace-nowrap"
          style={{
            background: filter === 'all' ? 'var(--panel-hi)' : 'var(--panel)',
            borderColor: filter === 'all' ? 'var(--line-2)' : 'var(--line)',
            color: filter === 'all' ? 'var(--text)' : 'var(--muted)',
          }}
        >
          All
        </button>
        {(['leading', 'improving', 'weakening', 'lagging'] as Quadrant[]).map(q => (
          <button
            key={q}
            onClick={() => setFilter(q)}
            className="flex-shrink-0 h-8 px-3 rounded-full text-[11px] font-medium border whitespace-nowrap flex items-center gap-1.5"
            style={{
              background: filter === q ? QUAD_BG[q] : 'var(--panel)',
              borderColor: filter === q ? QUAD_COLOR[q] : 'var(--line)',
              color: filter === q ? QUAD_COLOR[q] : 'var(--muted)',
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: QUAD_COLOR[q] }} />
            {SHORT_LABEL[q]} · {counts[q]}
          </button>
        ))}
      </div>

      {/* Rows */}
      {sorted.map((row, i) => {
        const quadColor = QUAD_COLOR[row.quad]
        const val = row[sortCol]
        return (
          <button
            key={row.ticker}
            onClick={() => setSelectedTicker(row.ticker)}
            className="grid items-center gap-3 px-4 py-3 border-b text-left transition-colors relative active:opacity-70"
            style={{
              gridTemplateColumns: '26px 1fr 60px 70px',
              borderColor: 'var(--line)',
            }}
          >
            <span
              className="absolute top-0 left-0 bottom-0 w-[3px]"
              style={{ background: quadColor }}
            />
            <span className="font-mono text-[11px] tabular-nums" style={{ color: 'var(--muted-2)' }}>
              {String(i + 1).padStart(2, '0')}
            </span>
            <div className="min-w-0">
              <div className="text-[15px] font-bold tracking-tight" style={{ color: 'var(--text)' }}>
                {row.ticker}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className="font-mono text-[9px] font-semibold tracking-[0.1em] px-1.5 py-0.5 rounded-[4px] flex-shrink-0"
                  style={{ background: QUAD_BG[row.quad], color: quadColor }}
                >
                  {SHORT_LABEL[row.quad]}
                </span>
                <span className="text-[11px] truncate" style={{ color: 'var(--muted)' }}>
                  {row.themeName}
                </span>
              </div>
            </div>
            <Sparkline values={row.rs_norm ?? []} color={quadColor} width={60} height={24} />
            <span
              className="font-mono text-[13px] font-semibold tabular-nums text-right"
              style={{ color: (val ?? 0) >= 0 ? 'var(--up)' : 'var(--down)' }}
            >
              {val != null ? `${val >= 0 ? '+' : ''}${val.toFixed(1)}%` : '—'}
            </span>
          </button>
        )
      })}

      {sorted.length === 0 && rsData.length === 0 && (
        <div className="px-4 py-2 flex flex-col gap-2">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="shimmer-line h-[54px] rounded-lg" />
          ))}
        </div>
      )}
      {sorted.length === 0 && rsData.length > 0 && (
        <div className="px-4 py-12 text-center text-[12px]" style={{ color: 'var(--muted-2)' }}>
          No ETFs in this quadrant.
        </div>
      )}

      {/* Bottom spacing for tab bar */}
      <div style={{ height: 100 }} />
    </div>
  )
}
