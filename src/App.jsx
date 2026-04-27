import MortgageRatesChart from './components/MortgageRatesChart'
import EconomicIndicatorsChart from './components/EconomicIndicatorsChart'
import TopMetrosTable from './components/TopMetrosTable'
import MSAGrowthTable from './components/MSAGrowthTable'
import USMapVisualization from './components/USMapVisualization'
import './App.css'

function App() {
  return (
    <div className="App">
      <header className="header">
        <h1>HMDA Graphical Reports Dashboard</h1>
        <p>Home Mortgage Disclosure Act Data Analysis</p>
      </header>

      <main className="main-content">
        <MortgageRatesChart />
        <EconomicIndicatorsChart />
        <TopMetrosTable />
        <MSAGrowthTable />
        <USMapVisualization />
      </main>
    </div>
  )
}

export default App
