import { useState, useEffect } from 'react'
import MortgageRatesChart from './components/MortgageRatesChart'
import EconomicIndicatorsChart from './components/EconomicIndicatorsChart'
import TopMetrosTable from './components/TopMetrosTable'
import MSAGrowthTable from './components/MSAGrowthTable'
import USMapVisualization from './components/USMapVisualization'
import './App.css'

const TABS = [
  { id: 'rates',      label: '30-Yr Mortgage Rates' },
  { id: 'indicators', label: 'Economic Indicators' },
  { id: 'metros',     label: 'Top Metro Markets' },
  { id: 'growth',     label: 'MSA Growth' },
  { id: 'map',        label: 'US Loan Map' },
]

function fmtM(n) {
  if (!n) return '—';
  return (n / 1_000_000).toFixed(1) + 'M';
}

function App() {
  const [activeTab, setActiveTab] = useState('rates')
  const [stats, setStats] = useState(null)

  useEffect(() => {
    fetch('/api/stats')
      .then(r => r.json())
      .then(d => setStats(d))
      .catch(() => {})
  }, [])

  return (
    <div className="app-shell">

      {/* ── Top nav ── */}
      <nav className="topnav">
        <div className="topnav-brand">
          <div className="topnav-logo">H</div>
          <div>
            <div className="topnav-title">HMDA Dashboard</div>
            <div className="topnav-sub">Home Mortgage Disclosure Act</div>
          </div>
        </div>

        <div className="topnav-links">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`topnav-link${activeTab === t.id ? ' active' : ''}`}
              onClick={() => setActiveTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="topnav-pill">Live · 2023–2024</div>
      </nav>

      {/* ── Hero ── */}
      <section className="hero">
        <div className="hero-text">
          <h1>US Mortgage Lending <span>Analytics</span></h1>
          <p>
            Nationwide HMDA data for 2023–2024 — originated Home Purchase &amp; Refinance loans,
            geographic trends, loan types, and economic indicators in one place.
          </p>
        </div>
        <div className="hero-stats">
          <div className="hero-stat">
            <div className="hero-stat-num accent">
              {stats ? fmtM(stats.totalRecords) : '—'}
            </div>
            <div className="hero-stat-lbl">Originated Loans</div>
          </div>
          <div className="hero-stat">
            <div className="hero-stat-num green">
              {stats?.byPurpose?.find(p => p.loan_purpose === '1')
                ? fmtM(stats.byPurpose.find(p => p.loan_purpose === '1').count)
                : '—'}
            </div>
            <div className="hero-stat-lbl">Home Purchase</div>
          </div>
          <div className="hero-stat">
            <div className="hero-stat-num">
              {stats?.byPurpose?.find(p => p.loan_purpose === '31')
                ? fmtM(stats.byPurpose.find(p => p.loan_purpose === '31').count)
                : '—'}
            </div>
            <div className="hero-stat-lbl">Refinancing</div>
          </div>
        </div>
      </section>

      {/* ── Content ── */}
      <main className="main-content">
        <div className={`section-panel${activeTab === 'rates'      ? ' visible' : ''}`}><MortgageRatesChart /></div>
        <div className={`section-panel${activeTab === 'indicators' ? ' visible' : ''}`}><EconomicIndicatorsChart /></div>
        <div className={`section-panel${activeTab === 'metros'     ? ' visible' : ''}`}><TopMetrosTable /></div>
        <div className={`section-panel${activeTab === 'growth'     ? ' visible' : ''}`}><MSAGrowthTable /></div>
        <div className={`section-panel${activeTab === 'map'        ? ' visible' : ''}`}><USMapVisualization /></div>
      </main>

    </div>
  )
}

export default App
