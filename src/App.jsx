import { useState } from 'react'
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

function App() {
  const [activeTab, setActiveTab] = useState('rates')

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
            Nationwide HMDA data for 2023–2024 — originations, denials, loan
            purpose, geographic trends, and economic indicators in one place.
          </p>
        </div>
        <div className="hero-stats">
          <div className="hero-stat">
            <div className="hero-stat-num accent">21.6M</div>
            <div className="hero-stat-lbl">Total Records</div>
          </div>
          <div className="hero-stat">
            <div className="hero-stat-num green">6.23%</div>
            <div className="hero-stat-lbl">Current 30-Yr Rate</div>
          </div>
          <div className="hero-stat">
            <div className="hero-stat-num">50</div>
            <div className="hero-stat-lbl">States Covered</div>
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
