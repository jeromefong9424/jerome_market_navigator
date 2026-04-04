import { useState, useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import { fetchThemeMap, type ThemeMapResponse, type ThemeMapBranch } from '../api'

const STATUS_LABELS: Record<string, string> = {
  running: 'Running',
  setting_up: 'Setting Up',
  early: 'Early',
  extended: 'Extended',
  correcting: 'Correcting',
}

const STATUS_COLORS: Record<string, string> = {
  running: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  setting_up: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  early: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20',
  extended: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
  correcting: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
}

function BranchCard({ branch }: { branch: ThemeMapBranch }) {
  return (
    <div className="border border-white/5 rounded-md p-3 bg-[#161b22]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold text-zinc-200">{branch.name}</span>
        <span className={`text-[9px] px-1.5 py-0.5 rounded border font-medium ${STATUS_COLORS[branch.status] ?? STATUS_COLORS.early}`}>
          {STATUS_LABELS[branch.status] ?? branch.status}
        </span>
      </div>

      <div className="flex flex-wrap gap-1 mb-1.5">
        {branch.tickers.map(t => (
          <span key={t} className="text-[10px] font-mono bg-[#1c2129] text-zinc-300 px-1.5 py-0.5 rounded border border-white/5">
            {t}
          </span>
        ))}
      </div>

      {branch.mapped_etf ? (
        <div className="text-[9px] text-zinc-600">
          ETF: <span className="text-zinc-400">{branch.mapped_etf}</span>
        </div>
      ) : (
        <div className="flex items-center gap-1 text-[9px] text-amber-500">
          <AlertTriangle size={8} />
          No ETF coverage
        </div>
      )}

      {branch.note && (
        <div className="text-[9px] text-zinc-500 mt-1.5 italic">{branch.note}</div>
      )}
    </div>
  )
}

export default function SupplyChainTab({ selectedThemeId }: { selectedThemeId: string | null }) {
  const [data, setData] = useState<ThemeMapResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetchThemeMap()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col gap-2 p-4">
        <div className="shimmer-line h-16 rounded" />
        <div className="grid grid-cols-2 gap-2">
          {[1, 2, 3, 4].map(i => <div key={i} className="shimmer-line h-24 rounded" />)}
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center py-12 text-zinc-600 text-xs">
        Unable to load supply chain data.
      </div>
    )
  }

  // Find the matching theme in the AI response
  const theme = data.themes.find(t => t.id === selectedThemeId)

  if (!theme) {
    return (
      <div className="flex flex-col gap-4 p-4">
        {/* Demand driver card at top */}
        <div className="border border-amber-500/20 bg-amber-500/5 rounded-md px-4 py-3">
          <div className="text-[9px] uppercase tracking-widest text-amber-500 mb-1">Demand Driver</div>
          <div className="text-zinc-500 text-[10px] italic">Select a theme to see its supply chain analysis.</div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {data.themes.slice(0, 4).map(t => (
            <div key={t.id} className="border border-white/5 rounded-md p-3 bg-[#161b22]">
              <div className="text-[10px] font-semibold text-zinc-400 mb-1">{t.id}</div>
              <div className="text-[9px] text-zinc-600">{t.demand_driver}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-4 overflow-y-auto">
      {/* Demand driver card */}
      <div className="border border-amber-500/20 bg-amber-500/5 rounded-md px-4 py-3">
        <div className="text-[9px] uppercase tracking-widest text-amber-500 mb-1">Demand Driver</div>
        <div className="text-[11px] font-semibold text-zinc-200 mb-1">{theme.demand_driver}</div>
        <div className="text-[10px] text-zinc-500 leading-relaxed">{theme.catalyst}</div>
      </div>

      {/* Branch cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {theme.branches.map((branch, i) => (
          <BranchCard key={i} branch={branch} />
        ))}
      </div>

      {theme.branches.length === 0 && (
        <div className="text-zinc-600 text-xs text-center py-8">
          No branch data available.
        </div>
      )}
    </div>
  )
}