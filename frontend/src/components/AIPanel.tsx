import { useState, useEffect } from 'react'
import { RefreshCw } from 'lucide-react'
import { fetchThemeMap, type ThemeMapResponse } from '../api'

function BriefingCard({ title, content, accent = 'purple' }: {
  title: string
  content: string
  accent?: 'purple' | 'green' | 'amber' | 'rose'
}) {
  const colors = {
    purple: { dot: '#bc8cff', border: 'rgba(188,140,255,0.2)', bg: 'rgba(188,140,255,0.05)' },
    green: { dot: '#2ea043', border: 'rgba(46,160,67,0.2)', bg: 'rgba(46,160,67,0.05)' },
    amber: { dot: '#d29922', border: 'rgba(210,153,34,0.2)', bg: 'rgba(210,153,34,0.05)' },
    rose: { dot: '#f85149', border: 'rgba(248,81,73,0.2)', bg: 'rgba(248,81,73,0.05)' },
  }[accent]

  return (
    <div className="border rounded-md p-3 mb-2 last:mb-0" style={{ borderColor: colors.border, background: colors.bg }}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: colors.dot }} />
        <span className="text-[9px] uppercase tracking-widest font-semibold" style={{ color: colors.dot }}>
          {title}
        </span>
      </div>
      <div className="text-[11px] text-zinc-400 leading-relaxed whitespace-pre-wrap">{content}</div>
    </div>
  )
}

export default function AIPanel() {
  const [expanded] = useState(true)
  const [data, setData] = useState<ThemeMapResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [dateStr, setDateStr] = useState('')

  const load = () => {
    setLoading(true)
    fetchThemeMap()
      .then(d => { setData(d); setDateStr(d.date) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  return (
    <div
      className="flex-shrink-0 border-l border-white/5 flex flex-col overflow-hidden transition-all duration-200"
      style={{ width: expanded ? 320 : 0 }}
    >
      {expanded && (
        <div className="flex flex-col w-[320px] h-full bg-[#0d1117]">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
              <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-semibold">
                AI Briefing
              </span>
              {dateStr && <span className="text-[9px] text-zinc-700">{dateStr}</span>}
            </div>
            <button
              onClick={load}
              disabled={loading}
              className="text-zinc-700 hover:text-zinc-400 transition-colors disabled:opacity-30"
            >
              <RefreshCw size={10} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-3">
            {data?.briefing ? (
              <>
                <BriefingCard
                  title="Market Regime"
                  content={data.briefing.regime}
                  accent="purple"
                />
                <BriefingCard
                  title="Hottest Themes"
                  content={data.briefing.hottest}
                  accent="green"
                />
                <BriefingCard
                  title="Coverage Gaps"
                  content={data.briefing.gaps}
                  accent="amber"
                />
                <BriefingCard
                  title="Avoid"
                  content={data.briefing.avoid}
                  accent="rose"
                />
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-zinc-600 text-xs">
                {loading ? 'Loading...' : 'No briefing available.'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}