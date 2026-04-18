import { TrendingUp, Layers, Bookmark, Sparkles } from 'lucide-react'

export type MobileTab = 'markets' | 'themes' | 'watchlist' | 'briefing'

interface MobileTabBarProps {
  active: MobileTab
  onChange: (tab: MobileTab) => void
}

const TABS: { id: MobileTab; label: string; Icon: typeof TrendingUp }[] = [
  { id: 'markets',   label: 'Markets',   Icon: TrendingUp },
  { id: 'themes',    label: 'Themes',    Icon: Layers },
  { id: 'watchlist', label: 'Watch',     Icon: Bookmark },
  { id: 'briefing',  label: 'Briefing',  Icon: Sparkles },
]

export default function MobileTabBar({ active, onChange }: MobileTabBarProps) {
  return (
    <div
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t"
      style={{
        height: 82,
        paddingBottom: 22,
        background: 'rgba(11,15,26,0.92)',
        borderColor: 'var(--line)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
      }}
    >
      <div className="grid grid-cols-4 h-full">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => onChange(id)}
            className="flex flex-col items-center justify-center gap-1 transition-colors"
            style={{ color: active === id ? 'var(--text)' : 'var(--muted-2)' }}
          >
            <Icon size={18} />
            <span className="text-[10px] font-medium">{label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
