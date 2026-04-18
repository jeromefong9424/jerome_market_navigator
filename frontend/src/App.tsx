import { useState, useEffect } from 'react'
import { Search } from 'lucide-react'
import RegimeBanner from './components/RegimeBanner'
import ThemeSidebar from './components/ThemeSidebar'
import ThemeETFTable from './components/ThemeETFTable'
import SupplyChainTab from './components/SupplyChainTab'
import AIPanel from './components/AIPanel'
import ETFDetailPanel from './components/ETFDetailPanel'
import MobileTabBar, { type MobileTab } from './components/MobileTabBar'
import MobileAISheet from './components/MobileAISheet'
import { fetchRS, fetchRegime } from './api'
import { useStore } from './store'
import themeGroups from './config/themeGroups.json'

type NavTab = 'markets' | 'themes' | 'watchlist' | 'briefing'

export default function App() {
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null)
  const [themeTab, setThemeTab] = useState<'etfs' | 'supply'>('etfs')
  const [navTab, setNavTab] = useState<NavTab>('markets')
  const [mobileTab, setMobileTab] = useState<MobileTab>('markets')
  const [aiSheetOpen, setAiSheetOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const selectedTicker = useStore(s => s.selectedTicker)
  const setSelectedTicker = useStore(s => s.setSelectedTicker)
  const [rsData, setRsData] = useState<{ ticker: string; rs_slope: number; rs_strength: number; rs_momentum: number; price?: number; pct_1w?: number | null; pct_1m?: number | null; ytd_pct?: number | null; from_high_pct?: number | null }[]>([])
  const [livePrices, setLivePrices] = useState<{ SPY: number; QQQ: number } | null>(null)
  const [wti, setWti] = useState<number | null>(null)

  // Load RS data for theme sidebar
  useEffect(() => {
    const allTickers = [
      'XLK', 'XLE', 'XLF', 'XLV', 'XLI', 'XLY', 'XLP', 'XLU', 'XLB', 'XLRE', 'XLC',
      'XOP', 'OIH', 'ITA', 'XHB', 'ITB', 'XRT', 'IBB', 'SMH', 'SOXX', 'GDX', 'GDXJ',
      'GLD', 'SLV', 'COPX', 'REMX', 'XME', 'MOO', 'PHO', 'JETS', 'XBI', 'FCG',
      'AIQ', 'DTCR', 'CLOU', 'WCLD', 'ARKW', 'IGV', 'BOTZ', 'HUMN', 'UFO', 'ARKX',
      'SHLD', 'CIBR', 'HACK', 'URNM', 'URA', 'NLR', 'GRID', 'ICLN', 'TAN', 'LIT',
      'DRIV', 'PAVE', 'IYT', 'FINX', 'IBIT', 'BKCH', 'ETHE', 'ARKG', 'ARKK', 'ARKQ',
      'QQQ', 'IWM', 'SPY',
    ]
    fetchRS(allTickers)
      .then((data: unknown) => setRsData(data as { ticker: string; rs_slope: number; rs_strength: number; rs_momentum: number }[]))
      .catch(() => {})
  }, [])

  // Fetch regime for live prices
  useEffect(() => {
    fetchRegime()
      .then(regime => {
        setLivePrices({ SPY: regime.spy.close, QQQ: regime.qqq.close })
      })
      .catch(() => {})
  }, [])

  // Fetch WTI oil price
  useEffect(() => {
    fetch('https://query1.finance.yahoo.com/v8/finance/chart/CL=F?interval=1d&range=1d')
      .then(r => r.json())
      .then(d => {
        const price = d?.chart?.result?.[0]?.meta?.regularMarketPrice
        if (price) setWti(price)
      })
      .catch(() => {})
  }, [])

  const tabs: { id: NavTab; label: string }[] = [
    { id: 'markets', label: 'Markets' },
    { id: 'themes', label: 'Themes' },
    { id: 'watchlist', label: 'Watchlist' },
    { id: 'briefing', label: 'Briefing' },
  ]

  return (
    <div className="app-bg relative flex flex-col min-h-screen overflow-hidden font-sans" style={{ background: 'var(--bg)', color: 'var(--text)' }}>

      {/* ── Quantum TopNav ── */}
      <div
        className="flex-shrink-0 flex items-center gap-4 px-5 h-14 border-b relative z-[2]"
        style={{
          background: 'rgba(11,15,26,0.8)',
          borderColor: 'var(--line)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        {/* Brand */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <div
            className="w-[26px] h-[26px] rounded-[7px] flex items-center justify-center"
            style={{
              background: 'conic-gradient(from 140deg at 50% 50%, #9b8cff, #6cb0ff, #4ee1d6, #9b8cff)',
            }}
          >
            <span className="text-[10px] font-extrabold text-white tracking-tight">JM</span>
          </div>
          <span className="text-[13px] font-semibold tracking-tight" style={{ color: 'var(--text)' }}>
            JMN <span style={{ color: 'var(--muted-2)' }}>· Navigator</span>
          </span>
        </div>

        {/* Nav tabs */}
        <nav className="flex items-center gap-1 ml-2 max-md:hidden">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setNavTab(t.id)}
              className="px-3 h-8 rounded-[10px] text-[12px] font-medium transition-colors"
              style={{
                background: navTab === t.id ? 'var(--panel-2)' : 'transparent',
                boxShadow: navTab === t.id ? 'inset 0 0 0 1px var(--line-2)' : 'none',
                color: navTab === t.id ? 'var(--text)' : 'var(--muted)',
              }}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {/* Search */}
        <div className="flex-1 flex justify-center max-md:hidden">
          <div
            className="flex items-center gap-2 px-3 h-8 w-[260px] rounded-[10px] border"
            style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}
          >
            <Search size={13} style={{ color: 'var(--muted-2)' }} />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search ticker, theme…"
              className="flex-1 bg-transparent outline-none text-[12px] font-mono placeholder:opacity-60"
              style={{ color: 'var(--text)' }}
            />
            <span className="font-mono text-[10px]" style={{ color: 'var(--muted-2)' }}>⌘K</span>
          </div>
        </div>

        {/* Live prices (mobile: compact) */}
        <div className="flex items-center gap-4 md:hidden flex-1 justify-end">
          {livePrices && (
            <span className="font-mono text-[11px]" style={{ color: 'var(--muted)' }}>
              SPY <span style={{ color: 'var(--text)' }}>${livePrices.SPY.toFixed(2)}</span>
            </span>
          )}
        </div>

        {/* Right: regime + avatar */}
        <div className="flex items-center gap-3 flex-shrink-0 ml-auto max-md:hidden">
          {livePrices ? (
            <>
              <div className="flex items-center gap-3 font-mono text-[11px]">
                <span style={{ color: 'var(--muted)' }}>SPY <span style={{ color: 'var(--text)' }}>${livePrices.SPY.toFixed(2)}</span></span>
                <span style={{ color: 'var(--muted)' }}>QQQ <span style={{ color: 'var(--text)' }}>${livePrices.QQQ.toFixed(2)}</span></span>
                {wti !== null && (
                  <span style={{ color: 'var(--muted)' }}>WTI <span style={{ color: 'var(--text)' }}>${wti.toFixed(2)}</span></span>
                )}
              </div>
              <div
                className="flex items-center gap-1.5 px-2.5 h-7 rounded-full border"
                style={{ background: 'rgba(57,214,123,0.08)', borderColor: 'rgba(57,214,123,0.25)' }}
              >
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--up)' }} />
                <span className="font-mono text-[10px] font-semibold tracking-wider" style={{ color: 'var(--up)' }}>GREEN</span>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3">
              {[1, 2, 3].map(i => <div key={i} className="shimmer-line h-4 w-16 rounded" />)}
            </div>
          )}
          <div
            className="w-[30px] h-[30px] rounded-full flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #9b8cff, #6cb0ff)' }}
          />
        </div>
      </div>

      {/* ── Regime strip ── */}
      <div className="flex-shrink-0 relative z-[1]">
        <RegimeBanner />
      </div>

      {/* ── Main content ── */}
      <div className="flex flex-1 overflow-hidden relative z-[1]">

        {/* Left: Theme sidebar */}
        <ThemeSidebar
          rsData={rsData}
          selectedTheme={selectedTheme}
          onSelectTheme={id => { setSelectedTheme(id); setThemeTab('etfs') }}
        />

        {/* Center content */}
        <div className="flex-1 flex flex-col overflow-hidden" style={{ background: 'transparent' }}>
          {selectedTicker ? (
            /* ETF detail view — TradingView iframe preserved inside */
            <div className="flex-1 overflow-y-auto">
              <ETFDetailPanel
                ticker={selectedTicker}
                onBack={() => setSelectedTicker(null)}
              />
            </div>
          ) : selectedTheme ? (
            <>
              {/* Theme detail header + tabs */}
              <div
                className="flex-shrink-0 px-4 py-2 flex items-center gap-4 border-b"
                style={{ borderColor: 'var(--line)' }}
              >
                <span className="text-[12px] font-semibold tracking-tight" style={{ color: 'var(--text)' }}>
                  {selectedTheme.replace(/_/g, ' ').toUpperCase()}
                </span>
                <div
                  className="flex items-center rounded-[10px] overflow-hidden border"
                  style={{ borderColor: 'var(--line)' }}
                >
                  <button
                    onClick={() => setThemeTab('etfs')}
                    className="px-3 py-1 text-[10px] font-semibold transition-colors"
                    style={{
                      background: themeTab === 'etfs' ? 'var(--panel-2)' : 'transparent',
                      color: themeTab === 'etfs' ? 'var(--text)' : 'var(--muted)',
                    }}
                  >
                    ETF List
                  </button>
                  <button
                    onClick={() => setThemeTab('supply')}
                    className="px-3 py-1 text-[10px] font-semibold transition-colors"
                    style={{
                      background: themeTab === 'supply' ? 'var(--panel-2)' : 'transparent',
                      color: themeTab === 'supply' ? 'var(--text)' : 'var(--muted)',
                    }}
                  >
                    Supply Chain
                  </button>
                </div>
              </div>

              {/* Tab content */}
              <div className="flex-1 overflow-y-auto">
                {themeTab === 'etfs' ? (
                  (() => {
                    const group = themeGroups.themes.find(g => g.id === selectedTheme)
                    return (
                      <ThemeETFTable
                        themeName={group?.name ?? selectedTheme ?? ''}
                        etfTickers={group?.etfs ?? []}
                        rsData={rsData}
                      />
                    )
                  })()
                ) : (
                  <SupplyChainTab selectedThemeId={selectedTheme} />
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-xs gap-3" style={{ color: 'var(--muted-2)' }}>
              <div style={{ color: 'var(--muted)' }}>Select an ETF from the sidebar</div>
            </div>
          )}
        </div>

        {/* Right: AI Briefing Panel */}
        <AIPanel />
      </div>

      {/* Mobile: bottom tab bar */}
      <MobileTabBar
        active={mobileTab}
        onChange={tab => {
          setMobileTab(tab)
          if (tab === 'briefing') setAiSheetOpen(true)
        }}
      />

      {/* Mobile: AI bottom sheet */}
      <MobileAISheet open={aiSheetOpen} onClose={() => { setAiSheetOpen(false); setMobileTab('markets') }} />
    </div>
  )
}
