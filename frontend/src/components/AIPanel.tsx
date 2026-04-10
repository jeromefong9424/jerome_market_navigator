import { useState, useRef, useCallback } from 'react'
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

function dateDaysAgo(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T00:00:00')
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    const diff = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
    if (diff <= 0) return ''
    if (diff === 1) return '1d ago'
    return `${diff}d ago`
  } catch {
    return ''
  }
}

export default function AIPanel() {
  const [collapsed, setCollapsed] = useState(false)
  const [data, setData] = useState<(ThemeMapResponse & { _source?: string }) | null>(null)
  const [loading, setLoading] = useState(false)
  const [dateStr, setDateStr] = useState('')
  const [source, setSource] = useState('')
  const [panelWidth, setPanelWidth] = useState(320)
  const resizing = useRef(false)

  const load = () => {
    setLoading(true)
    fetchThemeMap()
      .then((d: ThemeMapResponse & { _source?: string }) => {
        setData(d)
        setDateStr(d.date)
        setSource(d._source ?? '')
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  // Auto-load on first expand
  const [loaded, setLoaded] = useState(false)
  if (!loaded) {
    setLoaded(true)
    load()
  }

  const onResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    resizing.current = true
    const startX = e.clientX
    const startW = panelWidth
    const onMove = (ev: MouseEvent) => {
      if (!resizing.current) return
      const newW = Math.max(240, Math.min(600, startW - (ev.clientX - startX)))
      setPanelWidth(newW)
    }
    const onUp = () => {
      resizing.current = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [panelWidth])

  const age = dateStr ? dateDaysAgo(dateStr) : ''

  if (collapsed) {
    return (
      <div className="flex-shrink-0 border-l border-white/5 w-10 bg-[#0d1117] flex flex-col items-center py-3">
        <button onClick={() => setCollapsed(false)} className="text-zinc-600 hover:text-zinc-300 text-xs px-1 py-4">
          <span style={{ writingMode: 'vertical-rl' }}>◀ AI Briefing</span>
        </button>
      </div>
    )
  }

  return (
    <div
      className="flex-shrink-0 border-l border-white/5 flex flex-col overflow-hidden bg-[#0d1117] relative"
      style={{ width: panelWidth }}
    >
      {/* Resize handle (left edge) */}
      <div
        onMouseDown={onResizeStart}
        className="absolute top-0 left-0 w-1 h-full cursor-col-resize hover:bg-[#58a6ff]/40 transition-colors z-10"
      />

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
          <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-semibold">
            AI Briefing
          </span>
          {dateStr && (
            <span className="text-[9px] text-zinc-700">
              {dateStr}
              {age && <span className="text-zinc-600 ml-1">({age})</span>}
            </span>
          )}
          {source === 'fallback' && (
            <span className="text-[8px] bg-amber-900/30 text-amber-500 px-1 py-0.5 rounded">offline</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={load}
            disabled={loading}
            className="text-zinc-700 hover:text-zinc-400 transition-colors disabled:opacity-30"
          >
            <RefreshCw size={10} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => setCollapsed(true)} className="text-zinc-700 hover:text-zinc-400 transition-colors text-[10px]">
            ▶
          </button>
        </div>
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
  )
}
