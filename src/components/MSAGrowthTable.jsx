import { useState, useEffect } from 'react'
import './MSAGrowthTable.css'

const MSAGrowthTable = () => {
  const [growthData, setGrowthData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadGrowthData()
  }, [])

  const loadGrowthData = async () => {
    try {
      setLoading(true)
      setError('')

      const response = await fetch(`${import.meta.env.BASE_URL}data/top-metros.json`)
      if (!response.ok) {
        throw new Error('Failed to load metro data')
      }

      const data = await response.json()
      const data2023 = data['2023'] || []
      const data2024 = data['2024'] || []

      // Create a map of 2023 data by MSA code
      const map2023 = {}
      data2023.forEach(metro => {
        map2023[metro.msa] = metro
      })

      // Calculate growth for each MSA in 2024
      const growthMetros = data2024
        .map(metro2024 => {
          const metro2023 = map2023[metro2024.msa]
          if (!metro2023) return null

          const countChange = metro2024.totalCount - metro2023.totalCount
          const amountChange = metro2024.totalAmount - metro2023.totalAmount
          const countPctChange = metro2023.totalCount > 0
            ? ((metro2024.totalCount - metro2023.totalCount) / metro2023.totalCount) * 100
            : 0
          const amountPctChange = metro2023.totalAmount > 0
            ? ((metro2024.totalAmount - metro2023.totalAmount) / metro2023.totalAmount) * 100
            : 0

          return {
            msa: metro2024.msa,
            msaName: metro2024.msaName,
            count2023: metro2023.totalCount,
            count2024: metro2024.totalCount,
            countChange,
            countPctChange,
            amount2023: metro2023.totalAmount,
            amount2024: metro2024.totalAmount,
            amountChange,
            amountPctChange
          }
        })
        .filter(m => m !== null)
        .sort((a, b) => b.countPctChange - a.countPctChange)
        .slice(0, 25)

      setGrowthData(growthMetros)
    } catch (err) {
      console.error('Error loading growth data:', err)
      setError('Unable to load MSA growth data. Please run aggregation script first.')
    } finally {
      setLoading(false)
    }
  }

  const formatNumber = (num) => {
    if (num === null || num === undefined || isNaN(num)) return '-'
    return Math.round(num).toLocaleString()
  }

  const formatCurrency = (num) => {
    if (num === null || num === undefined || isNaN(num)) return '-'
    return `$${Math.round(num / 1000).toLocaleString()}`
  }

  const formatChange = (num) => {
    if (num === null || num === undefined || isNaN(num)) return '-'
    const sign = num >= 0 ? '+' : ''
    return `${sign}${Math.round(num).toLocaleString()}`
  }

  const formatPctChange = (num) => {
    if (num === null || num === undefined || isNaN(num)) return '-'
    const sign = num >= 0 ? '+' : ''
    return `${sign}${num.toFixed(1)}%`
  }

  return (
    <div className="msa-growth-section">
      <div className="growth-header">
        <h2>Top 25 MSAs by Origination Volume Growth</h2>
        <p className="growth-subtitle">
          Year-over-Year Change in Mortgage Originations (2023 to 2024)
        </p>
      </div>

      {loading ? (
        <div className="growth-loading">Calculating growth data...</div>
      ) : error ? (
        <div className="growth-error">{error}</div>
      ) : (
        <div className="table-wrapper">
          <table className="growth-table">
            <thead>
              <tr>
                <th rowSpan="2">Rank</th>
                <th rowSpan="2">Metro Market</th>
                <th colSpan="4">Origination Count</th>
                <th colSpan="4">Origination Volume ($000s)</th>
              </tr>
              <tr>
                <th>2023</th>
                <th>2024</th>
                <th>Change</th>
                <th>% Change</th>
                <th>2023</th>
                <th>2024</th>
                <th>Change</th>
                <th>% Change</th>
              </tr>
            </thead>
            <tbody>
              {growthData.map((metro, index) => (
                <tr key={metro.msa}>
                  <td className="rank-cell">{index + 1}</td>
                  <td className="metro-name">{metro.msaName}</td>
                  <td className="number-cell">{formatNumber(metro.count2023)}</td>
                  <td className="number-cell">{formatNumber(metro.count2024)}</td>
                  <td className={`change-cell ${metro.countChange >= 0 ? 'positive' : 'negative'}`}>
                    {formatChange(metro.countChange)}
                  </td>
                  <td className={`pct-cell ${metro.countPctChange >= 0 ? 'positive' : 'negative'}`}>
                    {formatPctChange(metro.countPctChange)}
                  </td>
                  <td className="currency-cell">{formatCurrency(metro.amount2023)}</td>
                  <td className="currency-cell">{formatCurrency(metro.amount2024)}</td>
                  <td className={`change-cell ${metro.amountChange >= 0 ? 'positive' : 'negative'}`}>
                    {formatChange(metro.amountChange / 1000)}
                  </td>
                  <td className={`pct-cell ${metro.amountPctChange >= 0 ? 'positive' : 'negative'}`}>
                    {formatPctChange(metro.amountPctChange)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default MSAGrowthTable
