import { useState, useRef, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'
import { fetchThemeMap, type ThemeMapResponse } from '../api'

type CalloutType = 'STRONG' | 'IMPROVING' | 'WATCH' | 'RISK'

const CALLOUT_STYLES: Record<CalloutType, { color: string; bg: string }> = {
  STRONG:    { color: 'var(--up)',      bg: 'rgba(57,214,123,0.12)' },
  IMPROVING: { color: 'var(--leading)', bg: 'rgba(155,140,255,0.12)' },
  WATCH:     { color: 'var(--weakening)', bg: 'rgba(242,179,102,0.12)' },
  RISK:      { color: 'var(--lagging)', bg: 'rgba(239,111,141,0.12)' },
}

function Callout({ type, content }: { type: CalloutType; content: string }) {
  const style = CALLOUT_STYLES[type]
  return (
    <div
      className="flex gap-2.5 p-3 rounded-[10px] border mb-2 last:mb-0"
      style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}
    >
      <span
        className="font-mono text-[9px] font-semibold tracking-[0.15em] px-1.5 py-0.5 rounded-[4px] h-fit flex-shrink-0 whitespace-nowrap"
        style={{ background: style.bg, color: style.color }}
      >
        {type}
      </span>
      <p className="text-[12px] leading-[1.5]" style={{ color: 'var(--text)' }}>
        {content}
      </p>
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
  } catch { return '' }
}

export default function AIPanel() {
  const [collapsed, setCollapsed] = useState(false)
  const [data, setData] = useState<(ThemeMapResponse & { _source?: string }) | null>(null)
  const [loading, setLoading] = useState(false)
  const [dateStr, setDateStr] = useState('')
  const [source, setSource] = useState('')
  const [panelWidth, setPanelWidth] = useState(340)
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

  const [loaded, setLoaded] = useState(false)
  if (!loaded) { setLoaded(true); load() }

  const onResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    resizing.current = true
    const startX = e.clientX
    const startW = panelWidth
    const onMove = (ev: MouseEvent) => {
      if (!resizing.current) return
      const newW = Math.max(260, Math.min(600, startW - (ev.clientX - startX)))
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
      <div
        className="flex-shrink-0 w-10 flex flex-col items-center py-3 border-l max-md:hidden"
        style={{ borderColor: 'var(--line)', background: 'transparent' }}
      >
        <button
          onClick={() => setCollapsed(false)}
          className="text-xs px-1 py-4"
          style={{ color: 'var(--muted-2)' }}
        >
          <span style={{ writingMode: 'vertical-rl' }}>◀ AI Briefing</span>
        </button>
      </div>
    )
  }

  return (
    <div
      className="flex-shrink-0 flex flex-col overflow-hidden border-l relative max-md:hidden"
      style={{ width: panelWidth, borderColor: 'var(--line)', background: 'transparent' }}
    >
      {/* Resize handle */}
      <div
        onMouseDown={onResizeStart}
        className="absolute top-0 left-0 w-1 h-full cursor-col-resize transition-colors z-10 hover:bg-[rgba(155,140,255,0.4)]"
      />

      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
        style={{ borderColor: 'var(--line)' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--leading)' }} />
          <span
            className="font-mono text-[10px] uppercase tracking-[0.18em] font-semibold"
            style={{ color: 'var(--leading)' }}
          >
            AI Briefing
          </span>
          {dateStr && (
            <span className="font-mono text-[9px]" style={{ color: 'var(--muted-2)' }}>
              {dateStr}
              {age && <span className="ml-1">({age})</span>}
            </span>
          )}
          {source === 'fallback' && (
            <span
              className="font-mono text-[8px] px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(242,179,102,0.15)', color: 'var(--weakening)' }}
            >
              offline
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="transition-colors disabled:opacity-30"
            style={{ color: 'var(--muted-2)' }}
          >
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setCollapsed(true)}
            className="text-[10px] transition-colors"
            style={{ color: 'var(--muted-2)' }}
          >
            ▶
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {data?.briefing ? (
          <>
            {/* Lede card */}
            <div
              className="p-3.5 rounded-xl border text-[13px] leading-[1.5] mb-3.5"
              style={{
                borderColor: 'var(--line)',
                background: 'linear-gradient(to bottom, rgba(155,140,255,0.05), transparent)',
                color: 'var(--text)',
              }}
            >
              <div
                className="font-mono text-[9px] tracking-[0.18em] uppercase mb-2 font-semibold"
                style={{ color: 'var(--leading)' }}
              >
                Market Regime
              </div>
              {data.briefing.regime}
            </div>

            {/* Callouts */}
            <Callout type="STRONG" content={data.briefing.hottest} />
            <Callout type="WATCH" content={data.briefing.gaps} />
            <Callout type="RISK" content={data.briefing.avoid} />
          </>
        ) : (
          <div
            className="flex items-center justify-center h-full text-xs"
            style={{ color: 'var(--muted-2)' }}
          >
            {loading ? 'Loading…' : 'No briefing available.'}
          </div>
        )}
      </div>
    </div>
  )
}
