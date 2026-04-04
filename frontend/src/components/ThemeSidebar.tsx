import { useState, useEffect, useRef } from 'react'
import { AlertTriangle } from 'lucide-react'
import themeGroups from '../config/themeGroups.json'

interface ThemeRow {
  id: string
  name: string
  etfs: string[]
  coverageGaps: { branch: string; missingETF: string | null; leaders: string[] }[]
  compositeRS: number
  leadingCount: number
  totalCount: number
  hasCoverageGap: boolean
}

interface TooltipData {
  themeId: string
  x: number
  y: number
}

function dotColor(rs: number) {
  if (rs > 1.0) return '#2ea043'
  if (rs >= 0) return '#d29922'
  return '#f85149'
}

export default function ThemeSidebar({
  rsData,
  selectedTheme,
  onSelectTheme,
}: {
  rsData: { ticker: string; rs_slope: number; rs_strength: number; rs_momentum: number }[]
  selectedTheme: string | null
  onSelectTheme: (id: string) => void
}) {
  const [themes, setThemes] = useState<ThemeRow[]>([])
  const [tooltip, setTooltip] = useState<TooltipData | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const tooltipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const rsMap = new Map(rsData.map(r => [r.ticker, r]))

    const rows: ThemeRow[] = themeGroups.themes.map(theme => {
      const themeRS = theme.etfs
        .map(t => rsMap.get(t)?.rs_slope ?? null)
        .filter((v): v is number => v !== null)
      const compositeRS = themeRS.length > 0
        ? themeRS.reduce((a, b) => a + b, 0) / themeRS.length
        : 0

      const leadingCount = theme.etfs.filter(t => {
        const r = rsMap.get(t)
        return r && r.rs_strength >= 100 && r.rs_momentum >= 0
      }).length

      return {
        id: theme.id,
        name: theme.name,
        etfs: theme.etfs,
        coverageGaps: theme.coverageGaps ?? [],
        compositeRS,
        leadingCount,
        totalCount: theme.etfs.length,
        hasCoverageGap: (theme.coverageGaps ?? []).length > 0,
      }
    })

    rows.sort((a, b) => b.compositeRS - a.compositeRS)
    setThemes(rows)
  }, [rsData])

  if (collapsed) {
    return (
      <div className="flex-shrink-0 border-r border-white/5 w-10 bg-[#0d1117] flex flex-col items-center py-3 gap-2">
        <button onClick={() => setCollapsed(false)} className="text-zinc-600 hover:text-zinc-300 text-xs px-1 py-4">
          <span className="writing-mode-vertical" style={{ writingMode: 'vertical-rl' }}>Themes ▶</span>
        </button>
      </div>
    )
  }

  return (
    <div className="flex-shrink-0 border-r border-white/5 w-[280px] bg-[#0d1117] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 flex-shrink-0">
        <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-semibold">
          Themes
        </span>
        <button
          onClick={() => setCollapsed(true)}
          className="text-zinc-700 hover:text-zinc-400 transition-colors"
        >
          ◀
        </button>
      </div>

      {/* Theme rows */}
      <div className="flex-1 overflow-y-auto">
        {themes.map(theme => {
          const isSelected = selectedTheme === theme.id
          const gapWarning = theme.hasCoverageGap

          return (
            <div key={theme.id} className="relative">
              <button
                onClick={() => onSelectTheme(theme.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left border-b border-white/[0.03] transition-all ${
                  isSelected
                    ? 'bg-[#1c2129] border-l-2 border-l-[#58a6ff]'
                    : 'hover:bg-[#161b22] border-l-2 border-l-transparent'
                }`}
              >
                {/* Status dot */}
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: dotColor(theme.compositeRS) }}
                />

                {/* Name + tickers */}
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-medium text-zinc-200 leading-tight">{theme.name}</div>
                  <div className="text-[9px] text-zinc-600 mt-0.5 truncate">
                    {theme.etfs.join(', ')}
                  </div>
                </div>

                {/* Right: RS + badges */}
                <div className="flex flex-col items-end gap-0.5 flex-shrink-0 ml-2">
                  <span className="text-[11px] font-mono font-semibold tabular-nums"
                    style={{ color: dotColor(theme.compositeRS) }}>
                    {theme.compositeRS >= 0 ? '+' : ''}{theme.compositeRS.toFixed(3)}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="text-[8px] text-zinc-600">
                      {theme.leadingCount}/{theme.totalCount}
                    </span>
                    {gapWarning && (
                      <span
                        className="cursor-help"
                        onMouseEnter={e => {
                          e.stopPropagation()
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                          setTooltip({ themeId: theme.id, x: rect.left, y: rect.bottom })
                        }}
                        onMouseLeave={e => {
                          e.stopPropagation()
                          setTooltip(null)
                        }}
                      >
                        <AlertTriangle size={9} className="text-amber-500" />
                      </span>
                    )}
                  </div>
                </div>
              </button>
            </div>
          )
        })}
      </div>

      {/* Coverage gap tooltip */}
      {tooltip && (() => {
        const theme = themes.find(t => t.id === tooltip.themeId)
        if (!theme) return null
        return (
          <div
            ref={tooltipRef}
            className="fixed z-50 bg-[#1c2129] border border-[#30363d] rounded-lg px-3 py-2 shadow-xl pointer-events-none"
            style={{ left: tooltip.x + 10, top: tooltip.y + 4, minWidth: 200 }}
          >
            <div className="text-[10px] font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">
              Coverage Gaps
            </div>
            {theme.coverageGaps.map((gap, i) => (
              <div key={i} className="mb-1.5 last:mb-0">
                <div className="text-[10px] text-amber-400 font-medium">{gap.branch}</div>
                {gap.missingETF && (
                  <div className="text-[9px] text-zinc-600">Missing ETF: {gap.missingETF}</div>
                )}
                <div className="text-[9px] text-zinc-500 mt-0.5">
                  Leaders: {gap.leaders.join(', ')}
                </div>
              </div>
            ))}
          </div>
        )
      })()}
    </div>
  )
}