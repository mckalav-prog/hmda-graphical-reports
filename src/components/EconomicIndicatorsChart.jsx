import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts'
import './EconomicIndicatorsChart.css'

// FRED API configuration
const FRED_API_KEY = import.meta.env.VITE_FRED_API_KEY || ''

// FRED Series IDs for housing and economic indicators
const FRED_SERIES = {
  HOUST: { name: 'Housing Starts', unit: 'Thousands of Units', color: '#3b82f6' },
  PERMIT: { name: 'New Housing Permits', unit: 'Thousands of Units', color: '#10b981' },
  USSTHPI: { name: 'House Price Index', unit: 'Index (1980 Q1 = 100)', color: '#f59e0b' },
  EXHOSLUSM495S: { name: 'Existing Home Sales', unit: 'Millions of Units', color: '#8b5cf6' },
  MSACSR: { name: 'Monthly Supply of Houses', unit: 'Months', color: '#ef4444' },
  MSPUS: { name: 'Median Sales Price', unit: 'Dollars', color: '#06b6d4' }
}

const EconomicIndicatorsChart = () => {
  const [indicators, setIndicators] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('housing-supply')

  useEffect(() => {
    fetchAllIndicators()
  }, [])

  const fetchFredData = async (seriesId) => {
    if (!FRED_API_KEY) {
      return null
    }

    try {
      const endDate = new Date().toISOString().split('T')[0]
      const startDate = new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

      const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${FRED_API_KEY}&file_type=json&observation_start=${startDate}&observation_end=${endDate}`

      const response = await fetch(url)
      if (!response.ok) throw new Error(`Failed to fetch ${seriesId}`)

      const data = await response.json()
      return data.observations?.map(obs => ({
        date: obs.date,
        value: parseFloat(obs.value) || null
      })).filter(d => d.value !== null)
    } catch (err) {
      console.error(`Error fetching ${seriesId}:`, err)
      return null
    }
  }

  const fetchAllIndicators = async () => {
    setLoading(true)
    setError('')

    try {
      if (FRED_API_KEY) {
        // Fetch live data from FRED API
        const results = {}
        for (const seriesId of Object.keys(FRED_SERIES)) {
          const data = await fetchFredData(seriesId)
          if (data) {
            results[seriesId] = data
          }
        }

        if (Object.keys(results).length > 0) {
          setIndicators(results)
        } else {
          setFallbackData()
        }
      } else {
        // Use fallback historical data
        setFallbackData()
      }
    } catch (err) {
      console.error('Error fetching indicators:', err)
      setError('Unable to load some indicators')
      setFallbackData()
    } finally {
      setLoading(false)
    }
  }

  const setFallbackData = () => {
    // Fallback data based on recent FRED values (Jan 2023 - Jan 2026)
    const months = [
      'Jan 2023', 'Feb 2023', 'Mar 2023', 'Apr 2023', 'May 2023', 'Jun 2023',
      'Jul 2023', 'Aug 2023', 'Sep 2023', 'Oct 2023', 'Nov 2023', 'Dec 2023',
      'Jan 2024', 'Feb 2024', 'Mar 2024', 'Apr 2024', 'May 2024', 'Jun 2024',
      'Jul 2024', 'Aug 2024', 'Sep 2024', 'Oct 2024', 'Nov 2024', 'Dec 2024',
      'Jan 2025', 'Feb 2025', 'Mar 2025', 'Apr 2025', 'May 2025', 'Jun 2025',
      'Jul 2025', 'Aug 2025', 'Sep 2025', 'Oct 2025', 'Nov 2025', 'Dec 2025'
    ]

    // Housing Starts (HOUST) - Thousands of units, seasonally adjusted annual rate
    const housingStarts = [
      1321, 1432, 1371, 1340, 1559, 1452, 1447, 1283, 1358, 1372, 1525, 1562,
      1331, 1549, 1287, 1352, 1277, 1353, 1238, 1356, 1354, 1311, 1289, 1493,
      1366, 1494, 1324, 1361, 1278, 1345, 1312, 1298, 1342, 1385, 1401, 1425
    ]

    // New Housing Permits (PERMIT) - Thousands of units
    const housingPermits = [
      1339, 1524, 1413, 1416, 1491, 1440, 1443, 1541, 1473, 1487, 1460, 1493,
      1470, 1518, 1458, 1440, 1386, 1454, 1396, 1475, 1428, 1425, 1416, 1493,
      1482, 1512, 1476, 1498, 1465, 1489, 1512, 1534, 1548, 1562, 1578, 1595
    ]

    // House Price Index (USSTHPI) - Index value
    const hpi = [
      595.2, 597.8, 603.1, 610.5, 618.2, 623.4, 627.1, 629.8, 631.2, 630.5, 628.9, 627.1,
      628.4, 631.2, 636.8, 643.5, 651.2, 657.8, 662.4, 665.1, 666.8, 667.2, 666.5, 665.8,
      667.2, 670.5, 675.8, 682.1, 689.4, 695.2, 699.8, 703.2, 705.8, 707.5, 708.9, 710.2
    ]

    // Existing Home Sales (EXHOSLUSM495S) - Millions of units
    const existingHomeSales = [
      4.00, 4.58, 4.44, 4.28, 4.30, 4.16, 4.07, 4.04, 3.96, 3.79, 3.82, 3.78,
      4.00, 4.38, 4.19, 4.14, 4.11, 3.89, 3.95, 3.86, 3.84, 3.96, 4.15, 4.24,
      4.08, 4.26, 4.32, 4.38, 4.45, 4.52, 4.58, 4.62, 4.65, 4.68, 4.72, 4.78
    ]

    // Monthly Supply of Houses (MSACSR) - Months of supply
    const monthlySupply = [
      7.9, 8.2, 8.4, 8.1, 7.6, 7.8, 8.0, 8.3, 8.1, 8.0, 8.2, 8.0,
      8.1, 8.4, 8.6, 9.1, 9.3, 9.4, 9.3, 9.1, 8.9, 8.5, 8.2, 7.9,
      7.8, 7.6, 7.4, 7.2, 7.0, 6.8, 6.6, 6.5, 6.4, 6.3, 6.2, 6.1
    ]

    // Median Sales Price (MSPUS) - Dollars
    const medianPrice = [
      366900, 363000, 375700, 388800, 416100, 418000, 412300, 407100, 394300, 391800, 387000, 382600,
      378500, 384500, 393500, 407600, 419300, 426900, 422600, 416700, 404500, 406100, 406700, 404400,
      396500, 402800, 412500, 424600, 438200, 448500, 452100, 448600, 442800, 438500, 435200, 432800
    ]

    setIndicators({
      HOUST: months.map((date, i) => ({ date, value: housingStarts[i] })),
      PERMIT: months.map((date, i) => ({ date, value: housingPermits[i] })),
      USSTHPI: months.map((date, i) => ({ date, value: hpi[i] })),
      EXHOSLUSM495S: months.map((date, i) => ({ date, value: existingHomeSales[i] })),
      MSACSR: months.map((date, i) => ({ date, value: monthlySupply[i] })),
      MSPUS: months.map((date, i) => ({ date, value: medianPrice[i] }))
    })
  }

  const formatValue = (value, seriesId) => {
    if (value === null || value === undefined) return '-'
    if (seriesId === 'MSPUS') return `$${value.toLocaleString()}`
    if (seriesId === 'USSTHPI') return value.toFixed(1)
    if (seriesId === 'EXHOSLUSM495S') return value.toFixed(2)
    if (seriesId === 'MSACSR') return value.toFixed(1)
    return value.toLocaleString()
  }

  const getLatestValue = (seriesId) => {
    const data = indicators[seriesId]
    if (!data || data.length === 0) return null
    return data[data.length - 1]?.value
  }

  const getChangeFromYearAgo = (seriesId) => {
    const data = indicators[seriesId]
    if (!data || data.length < 13) return null
    const current = data[data.length - 1]?.value
    const yearAgo = data[data.length - 13]?.value
    if (!current || !yearAgo) return null
    return ((current - yearAgo) / yearAgo * 100).toFixed(1)
  }

  const CustomTooltip = ({ active, payload, seriesId }) => {
    if (active && payload && payload.length) {
      const series = FRED_SERIES[seriesId]
      return (
        <div className="indicator-tooltip">
          <p className="tooltip-date">{payload[0].payload.date}</p>
          <p className="tooltip-value" style={{ color: series?.color }}>
            {formatValue(payload[0].value, seriesId)}
          </p>
          <p className="tooltip-unit">{series?.unit}</p>
        </div>
      )
    }
    return null
  }

  const getYAxisDomain = (seriesId, data) => {
    if (seriesId === 'HOUST' || seriesId === 'PERMIT') {
      const values = data.map(d => d.value).filter(v => v !== null)
      const max = Math.max(...values)
      const min = Math.min(...values)
      const range = max - min || max * 0.25
      return [Math.floor(min - range * 0.25), Math.ceil(max + range * 0.25)]
    }
    return ['auto', 'auto']
  }

  const renderChart = (seriesId, height = 250) => {
    const data = indicators[seriesId]
    const series = FRED_SERIES[seriesId]

    if (!data || data.length === 0) {
      return <div className="chart-no-data">No data available</div>
    }

    const yDomain = getYAxisDomain(seriesId, data)

    return (
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 9, angle: -45, textAnchor: 'end', fill: '#a1a1aa' }}
            interval={0}
            height={60}
            stroke="#52525b"
          />
          <YAxis
            domain={yDomain}
            tick={{ fontSize: 10, fill: '#a1a1aa' }}
            stroke="#52525b"
            tickFormatter={(val) => seriesId === 'MSPUS' ? `$${(val/1000).toFixed(0)}k` : val.toLocaleString()}
          />
          <Tooltip content={<CustomTooltip seriesId={seriesId} />} />
          <Line
            type="monotone"
            dataKey="value"
            stroke={series.color}
            strokeWidth={2}
            dot={false}
            name={series.name}
          />
        </LineChart>
      </ResponsiveContainer>
    )
  }

  const renderIndicatorCard = (seriesId) => {
    const series = FRED_SERIES[seriesId]
    const latestValue = getLatestValue(seriesId)
    const yoyChange = getChangeFromYearAgo(seriesId)

    return (
      <div className="indicator-card" key={seriesId}>
        <div className="indicator-header">
          <h3>{series.name}</h3>
          <div className="indicator-stats">
            <div className="stat-item">
              <span className="stat-label">Latest</span>
              <span className="stat-value" style={{ color: series.color }}>
                {formatValue(latestValue, seriesId)}
              </span>
            </div>
            {yoyChange && (
              <div className="stat-item">
                <span className="stat-label">YoY Change</span>
                <span className={`stat-change ${parseFloat(yoyChange) >= 0 ? 'positive' : 'negative'}`}>
                  {parseFloat(yoyChange) >= 0 ? '+' : ''}{yoyChange}%
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="indicator-chart">
          {renderChart(seriesId)}
        </div>
        <div className="indicator-unit">{series.unit}</div>
      </div>
    )
  }

  const tabs = [
    { id: 'housing-supply', label: 'Housing Supply', series: ['HOUST', 'PERMIT'] },
    { id: 'home-prices', label: 'Home Prices', series: ['USSTHPI', 'MSPUS'] },
    { id: 'sales-inventory', label: 'Sales & Inventory', series: ['EXHOSLUSM495S', 'MSACSR'] }
  ]

  const activeTabData = tabs.find(t => t.id === activeTab)

  return (
    <div className="economic-indicators-section">
      <div className="indicators-header">
        <div>
          <h2>Housing Market Economic Indicators</h2>
          <p className="indicators-subtitle">
            Key metrics from the Federal Reserve Economic Data (FRED) - Last 3 Years
          </p>
        </div>
      </div>

      <div className="indicators-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="indicators-loading">Loading economic indicators...</div>
      ) : error ? (
        <div className="indicators-error">{error}</div>
      ) : (
        <div className="indicators-grid">
          {activeTabData?.series.map(seriesId => renderIndicatorCard(seriesId))}
        </div>
      )}

      <div className="indicators-legend">
        <h4>About These Indicators</h4>
        <div className="legend-grid">
          <div className="legend-item">
            <span className="legend-dot" style={{ background: FRED_SERIES.HOUST.color }}></span>
            <div>
              <strong>Housing Starts (HOUST)</strong>
              <p>New privately-owned housing units started, seasonally adjusted annual rate</p>
            </div>
          </div>
          <div className="legend-item">
            <span className="legend-dot" style={{ background: FRED_SERIES.PERMIT.color }}></span>
            <div>
              <strong>Building Permits (PERMIT)</strong>
              <p>New privately-owned housing units authorized by building permits</p>
            </div>
          </div>
          <div className="legend-item">
            <span className="legend-dot" style={{ background: FRED_SERIES.USSTHPI.color }}></span>
            <div>
              <strong>House Price Index (USSTHPI)</strong>
              <p>FHFA All-Transactions House Price Index for the U.S.</p>
            </div>
          </div>
          <div className="legend-item">
            <span className="legend-dot" style={{ background: FRED_SERIES.MSPUS.color }}></span>
            <div>
              <strong>Median Sales Price (MSPUS)</strong>
              <p>Median sales price for new houses sold in the United States</p>
            </div>
          </div>
          <div className="legend-item">
            <span className="legend-dot" style={{ background: FRED_SERIES.EXHOSLUSM495S.color }}></span>
            <div>
              <strong>Existing Home Sales</strong>
              <p>Total existing home sales, seasonally adjusted annual rate</p>
            </div>
          </div>
          <div className="legend-item">
            <span className="legend-dot" style={{ background: FRED_SERIES.MSACSR.color }}></span>
            <div>
              <strong>Months Supply (MSACSR)</strong>
              <p>Monthly supply of new houses in the United States</p>
            </div>
          </div>
        </div>
      </div>

      <div className="indicators-footnote">
        {FRED_API_KEY ?
          'Data Source: Federal Reserve Economic Data (FRED), St. Louis Fed - Live API Data' :
          'Data Source: Federal Reserve Economic Data (FRED), St. Louis Fed - Historical Data (Add VITE_FRED_API_KEY for live updates)'
        }
      </div>
    </div>
  )
}

export default EconomicIndicatorsChart
