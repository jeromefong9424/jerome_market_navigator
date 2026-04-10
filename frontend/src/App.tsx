import { useState, useEffect } from 'react'
import RegimeBanner from './components/RegimeBanner'
import ThemeSidebar from './components/ThemeSidebar'
import ThemeETFTable from './components/ThemeETFTable'
import SupplyChainTab from './components/SupplyChainTab'
import AIPanel from './components/AIPanel'
import ETFDetailPanel from './components/ETFDetailPanel'
import { fetchRS, fetchRegime } from './api'
import { useStore } from './store'
import themeGroups from './config/themeGroups.json'

export default function App() {
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null)
  const [themeTab, setThemeTab] = useState<'etfs' | 'supply'>('etfs')
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

      </div>

      {/* ── Regime strip ── */}
      <div className="flex-shrink-0">
        <RegimeBanner />
      </div>

      {/* ── Main content ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left: Theme sidebar */}
        <ThemeSidebar
          rsData={rsData}
          selectedTheme={selectedTheme}
          onSelectTheme={id => { setSelectedTheme(id); setThemeTab('etfs') }}
        />

        {/* Center content */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#0d1117]">
          {selectedTicker ? (
            /* ETF detail view */
            <div className="flex-1 overflow-y-auto">
              <ETFDetailPanel
                ticker={selectedTicker}
                onBack={() => setSelectedTicker(null)}
              />
            </div>
          ) : selectedTheme ? (
            <>
              {/* Theme detail header + tabs */}
              <div className="flex-shrink-0 border-b border-white/5 px-4 py-2 flex items-center gap-4">
                <span className="text-[12px] font-semibold text-zinc-200">
                  {selectedTheme.replace(/_/g, ' ').toUpperCase()}
                </span>
                <div className="flex items-center rounded-md border border-white/10 overflow-hidden">
                  <button
                    onClick={() => setThemeTab('etfs')}
                    className={`px-3 py-1 text-[10px] font-semibold transition-colors ${
                      themeTab === 'etfs' ? 'bg-[#1c2129] text-zinc-200' : 'text-zinc-600 hover:text-zinc-400'
                    }`}
                  >
                    ETF List
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
            <div className="flex flex-col items-center justify-center h-full text-zinc-600 text-xs gap-3">
              <div className="text-zinc-500">Select an ETF from the sidebar</div>
            </div>
          )}
        </div>

        {/* Right: AI Briefing Panel */}
        <AIPanel />
      </div>
    </div>
  )
}