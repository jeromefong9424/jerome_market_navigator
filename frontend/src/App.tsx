import { useState, useEffect } from 'react'
import RegimeBanner from './components/RegimeBanner'
import ThemeSidebar from './components/ThemeSidebar'
import Top10LeadersTable from './components/Top10LeadersTable'
import SupplyChainTab from './components/SupplyChainTab'
import AIPanel from './components/AIPanel'
import RSDashboard from './pages/RSDashboard'
import { fetchRS, fetchRegime } from './api'

type ViewMode = 'all_etfs' | 'themes'

export default function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('themes')
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null)
  const [themeTab, setThemeTab] = useState<'leaders' | 'supply'>('leaders')
  const [rsData, setRsData] = useState<{ ticker: string; rs_slope: number; rs_strength: number; rs_momentum: number }[]>([])
  const [livePrices, setLivePrices] = useState<{ SPY: number; QQQ: number } | null>(null)
  const [wti, setWti] = useState<number | null>(null)

  // Load RS data for theme sidebar
  useEffect(() => {
    const allTickers = [
      'XLK', 'XLE', 'XLF', 'XLV', 'XLI', 'XLY', 'XLP', 'XLU', 'XLB', 'XLRE',
      'XOP', 'ITA', 'XHB', 'ITB', 'XRT', 'IBB', 'SMH', 'GDX', 'GDXJ', 'GLD',
      'SLV', 'COPX', 'REMX', 'MOO', 'PHO', 'JETS', 'XBI', 'FCG', 'AIQ', 'DTCR',
      'CLOU', 'WCLD', 'ARKW', 'BOTZ', 'HUMN', 'UFO', 'ARKX', 'SHLD', 'CIBR',
      'HACK', 'URNM', 'NLR', 'GRID', 'ICLN', 'LIT', 'DRIV', 'PAVE', 'FINX',
      'IBIT', 'BKCH', 'ARKG', 'ARKK', 'ARKQ', 'QQQ', 'IWM', 'SPY',
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

  return (
    <div className="flex flex-col bg-[#0d1117] text-white min-h-screen font-sans overflow-hidden">

      {/* ── Top navigation bar ── */}
      <div className="flex-shrink-0 flex items-center px-4 py-2 border-b border-white/5 gap-4 bg-[#0d1117]">
        {/* Logo */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-5 h-5 rounded bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <span className="text-[9px] font-bold text-white">JM</span>
          </div>
          <span className="text-[12px] font-bold text-zinc-300 tracking-wide">JMN</span>
        </div>

        {/* Live prices */}
        <div className="flex items-center gap-4 ml-4">
          {livePrices ? (
            <>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-zinc-600">SPY</span>
                <span className="text-[12px] font-mono font-semibold text-zinc-200">${livePrices.SPY.toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-zinc-600">QQQ</span>
                <span className="text-[12px] font-mono font-semibold text-zinc-200">${livePrices.QQQ.toFixed(2)}</span>
              </div>
              {wti !== null && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-zinc-600">WTI</span>
                  <span className="text-[12px] font-mono font-semibold text-zinc-200">${wti.toFixed(2)}</span>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center gap-4">
              {[1, 2, 3].map(i => <div key={i} className="shimmer-line h-4 w-16 rounded" />)}
            </div>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* View toggle */}
        <div className="flex items-center rounded-md border border-white/10 overflow-hidden flex-shrink-0">
          <button
            onClick={() => setViewMode('themes')}
            className={`px-3 py-1.5 text-[10px] font-semibold transition-colors ${
              viewMode === 'themes' ? 'bg-[#1c2129] text-zinc-200' : 'text-zinc-600 hover:text-zinc-400'
            }`}
          >
            Themes
          </button>
          <button
            onClick={() => setViewMode('all_etfs')}
            className={`px-3 py-1.5 text-[10px] font-semibold transition-colors ${
              viewMode === 'all_etfs' ? 'bg-[#1c2129] text-zinc-200' : 'text-zinc-600 hover:text-zinc-400'
            }`}
          >
            All ETFs
          </button>
        </div>
      </div>

      {/* ── Regime strip ── */}
      <div className="flex-shrink-0">
        <RegimeBanner />
      </div>

      {/* ── Main content ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left: Theme sidebar (themes view only) */}
        {viewMode === 'themes' && (
          <ThemeSidebar
            rsData={rsData}
            selectedTheme={selectedTheme}
            onSelectTheme={id => { setSelectedTheme(id); setThemeTab('leaders') }}
          />
        )}

        {/* Center content */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#0d1117]">
          {viewMode === 'themes' ? (
            selectedTheme ? (
              <>
                {/* Theme detail header + tabs */}
                <div className="flex-shrink-0 border-b border-white/5 px-4 py-2 flex items-center gap-4">
                  <span className="text-[12px] font-semibold text-zinc-200">
                    {selectedTheme.replace(/_/g, ' ').toUpperCase()}
                  </span>
                  <div className="flex items-center rounded-md border border-white/10 overflow-hidden">
                    <button
                      onClick={() => setThemeTab('leaders')}
                      className={`px-3 py-1 text-[10px] font-semibold transition-colors ${
                        themeTab === 'leaders' ? 'bg-[#1c2129] text-zinc-200' : 'text-zinc-600 hover:text-zinc-400'
                      }`}
                    >
                      Top 10 + Chart
                    </button>
                    <button
                      onClick={() => setThemeTab('supply')}
                      className={`px-3 py-1 text-[10px] font-semibold transition-colors ${
                        themeTab === 'supply' ? 'bg-[#1c2129] text-zinc-200' : 'text-zinc-600 hover:text-zinc-400'
                      }`}
                    >
                      Supply Chain
                    </button>
                  </div>
                </div>

                {/* Tab content */}
                <div className="flex-1 overflow-y-auto">
                  {themeTab === 'leaders' ? (
                    <Top10LeadersTable
                      themeId={selectedTheme}
                    />
                  ) : (
                    <SupplyChainTab selectedThemeId={selectedTheme} />
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-zinc-600 text-xs gap-3">
                <div className="text-zinc-500">← Select a theme from the sidebar</div>
              </div>
            )
          ) : (
            /* All ETFs view — use existing RSDashboard */
            <div className="flex-1 overflow-hidden">
              <RSDashboard />
            </div>
          )}
        </div>

        {/* Right: AI Briefing Panel */}
        <AIPanel />
      </div>
    </div>
  )
}