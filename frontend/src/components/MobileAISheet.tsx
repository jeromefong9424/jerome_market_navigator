import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { fetchThemeMap, type ThemeMapResponse } from '../api'

type CalloutType = 'STRONG' | 'IMPROVING' | 'WATCH' | 'RISK'

const CALLOUT_STYLES: Record<CalloutType, { color: string; bg: string }> = {
  STRONG:    { color: 'var(--up)',      bg: 'rgba(57,214,123,0.12)' },
  IMPROVING: { color: 'var(--leading)', bg: 'rgba(155,140,255,0.12)' },
  WATCH:     { color: 'var(--weakening)', bg: 'rgba(242,179,102,0.12)' },
  RISK:      { color: 'var(--lagging)', bg: 'rgba(239,111,141,0.12)' },
}

interface MobileAISheetProps {
  open: boolean
  onClose: () => void
}

export default function MobileAISheet({ open, onClose }: MobileAISheetProps) {
  const [data, setData] = useState<ThemeMapResponse | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (open && !loaded) {
      setLoaded(true)
      fetchThemeMap().then(setData).catch(() => {})
    }
  }, [open, loaded])

  if (!open) return null

  return (
    <div
      className="md:hidden fixed inset-0 z-50 flex items-end"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full rounded-t-[24px] border-t max-h-[80%] overflow-y-auto"
        style={{ background: '#10152a', borderColor: 'var(--line-2)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Grip */}
        <div className="flex justify-center py-3">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--line-2)' }} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3">
          <span
            className="font-mono text-[10px] uppercase tracking-[0.18em] font-semibold"
            style={{ color: 'var(--leading)' }}
          >
            ● AI Briefing
          </span>
          <button onClick={onClose} style={{ color: 'var(--muted)' }}>
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="px-4 pb-8">
          {data?.briefing ? (
            <>
              <div
                className="p-3.5 rounded-xl border text-[13px] leading-[1.5] mb-3"
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

              {[
                { type: 'STRONG' as CalloutType, content: data.briefing.hottest },
                { type: 'WATCH' as CalloutType, content: data.briefing.gaps },
                { type: 'RISK' as CalloutType, content: data.briefing.avoid },
              ].map(({ type, content }) => {
                const style = CALLOUT_STYLES[type]
                return (
                  <div
                    key={type}
                    className="flex gap-2.5 p-3 rounded-[10px] border mb-2"
                    style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}
                  >
                    <span
                      className="font-mono text-[9px] font-semibold tracking-[0.15em] px-1.5 py-0.5 rounded-[4px] h-fit flex-shrink-0"
                      style={{ background: style.bg, color: style.color }}
                    >
                      {type}
                    </span>
                    <p className="text-[12px] leading-[1.5]" style={{ color: 'var(--text)' }}>
                      {content}
                    </p>
                  </div>
                )
              })}
            </>
          ) : (
            <div className="py-8 text-center text-xs" style={{ color: 'var(--muted-2)' }}>
              Loading briefing…
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
