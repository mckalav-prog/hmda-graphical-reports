import { useState, useEffect } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import './TopMetrosTable.css'

// State FIPS code to name mapping
const STATE_NAMES = {
  'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
  'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
  'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
  'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
  'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri',
  'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
  'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
  'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
  'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont',
  'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming',
  'DC': 'District of Columbia', 'PR': 'Puerto Rico', 'GU': 'Guam', 'VI': 'Virgin Islands'
}

// Sort options configuration
const SORT_OPTIONS = [
  { value: 'totalCount', label: 'Total # (Volume)' },
  { value: 'totalAmount', label: 'Total $ (Amount)' },
  { value: 'avgTotal', label: 'Total Avg $ (Loan Size)' },
  { value: 'medianTotal', label: 'Total Median Home Value' },
  { value: 'totalPctCount', label: 'Total % of #' },
  { value: 'totalPctAmount', label: 'Total % of $' },
  { value: 'yoyCountChange', label: 'YoY %Δ # (Volume)' },
  { value: 'yoyAmountChange', label: 'YoY %Δ $ (Amount)' },
  { value: 'purchaseCount', label: 'Purchase #' },
  { value: 'purchaseAmount', label: 'Purchase $' },
  { value: 'avgPurchase', label: 'Purchase Avg $ (Loan Size)' },
  { value: 'medianPurchase', label: 'Purchase Median Home Value' },
  { value: 'purchasePctCount', label: 'Purchase % of #' },
  { value: 'purchasePctAmount', label: 'Purchase % of $' },
  { value: 'refinanceCount', label: 'Refinance #' },
  { value: 'refinanceAmount', label: 'Refinance $' },
  { value: 'avgRefinance', label: 'Refinance Avg $ (Loan Size)' },
  { value: 'medianRefinance', label: 'Refinance Median Home Value' },
  { value: 'refinancePctCount', label: 'Refinance % of #' },
  { value: 'refinancePctAmount', label: 'Refinance % of $' }
]

const TopMetrosTable = () => {
  const [data, setData] = useState([])
  const [prevYearData, setPrevYearData] = useState({})
  const [selectedYear, setSelectedYear] = useState('2024')
  const [viewType, setViewType] = useState('msa') // 'msa', 'state', 'lender'
  const [sortBy, setSortBy] = useState('totalCount')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadData()
  }, [selectedYear, viewType])

  const loadData = async () => {
    try {
      setLoading(true)
      setError('')

      // Determine which file to load based on viewType
      const fileMap = {
        'msa': '/data/top-metros.json',
        'state': '/data/by-state.json',
        'lender': '/data/by-lender.json'
      }

      const response = await fetch(fileMap[viewType])
      if (!response.ok) {
        throw new Error('Failed to load data')
      }

      const jsonData = await response.json()

      if (jsonData[selectedYear]) {
        setData(jsonData[selectedYear])
      } else {
        setData([])
      }

      // Load previous year data for YoY calculations
      const prevYear = String(parseInt(selectedYear) - 1)
      if (jsonData[prevYear]) {
        // Create a lookup map by identifier
        const prevMap = {}
        jsonData[prevYear].forEach(item => {
          const key = getItemKey(item)
          prevMap[key] = item
        })
        setPrevYearData(prevMap)
      } else {
        setPrevYearData({})
      }
    } catch (err) {
      console.error('Error loading data:', err)
      setError(`Unable to load ${getViewLabel()} data. Please run aggregation script first.`)
    } finally {
      setLoading(false)
    }
  }

  const getItemKey = (item) => {
    if (viewType === 'msa') return item.msa
    if (viewType === 'state') return item.state
    if (viewType === 'lender') return item.lei
    return ''
  }

  const getItemName = (item) => {
    if (viewType === 'msa') return item.msaName
    if (viewType === 'state') return STATE_NAMES[item.state] || item.state
    if (viewType === 'lender') return item.lenderName || item.lei
    return ''
  }

  const getViewLabel = () => {
    const labels = {
      'msa': 'Metro Market',
      'state': 'State',
      'lender': 'Lender'
    }
    return labels[viewType]
  }

  const getTableTitle = () => {
    const titles = {
      'msa': 'Top 50 Metro Markets for the U.S.',
      'state': 'Top 50 States by Origination Volume',
      'lender': 'Top 50 Lenders by Origination Volume'
    }
    return titles[viewType]
  }

  const calculateYoYChange = (currentValue, itemKey) => {
    const prevItem = prevYearData[itemKey]
    if (!prevItem) return null

    const prevValue = prevItem.totalCount
    if (!prevValue || prevValue === 0) return null

    return ((currentValue - prevValue) / prevValue) * 100
  }

  const calculateYoYAmountChange = (currentValue, itemKey) => {
    const prevItem = prevYearData[itemKey]
    if (!prevItem) return null

    const prevValue = prevItem.totalAmount
    if (!prevValue || prevValue === 0) return null

    return ((currentValue - prevValue) / prevValue) * 100
  }

  const formatNumber = (num) => {
    if (!num || isNaN(num)) return '-'
    return Math.round(num).toLocaleString()
  }

  const formatCurrency = (num) => {
    if (!num || isNaN(num)) return '-'
    return `$${Math.round(num / 1000).toLocaleString()}`
  }

  const formatPercent = (num) => {
    if (!num || isNaN(num)) return '-'
    return `${num.toFixed(2)}%`
  }

  const formatChange = (num) => {
    if (num === null || num === undefined || isNaN(num)) return '-'
    const sign = num >= 0 ? '+' : ''
    return `${sign}${num.toFixed(1)}%`
  }

  // Normalize avg loan size field names across data sources
  const getAvgTotal = (item) => item.avgTotalLoanSize || item.avgLoanSize || 0
  const getAvgPurchase = (item) => item.avgPurchaseLoanSize || item.avgPurchaseSize || 0
  const getAvgRefinance = (item) => item.avgRefinanceLoanSize || item.avgRefinanceSize || 0

  // Median home value helpers
  const getMedianTotal = (item) => item.medianHomeValue || 0
  const getMedianPurchase = (item) => item.medianPurchaseHomeValue || 0
  const getMedianRefinance = (item) => item.medianRefinanceHomeValue || 0

  // Calculate YoY for an item (used for sorting)
  const getYoYCountChange = (item) => {
    const itemKey = getItemKey(item)
    const prevItem = prevYearData[itemKey]
    if (!prevItem || !prevItem.totalCount) return -Infinity
    return ((item.totalCount - prevItem.totalCount) / prevItem.totalCount) * 100
  }

  const getYoYAmountChange = (item) => {
    const itemKey = getItemKey(item)
    const prevItem = prevYearData[itemKey]
    if (!prevItem || !prevItem.totalAmount) return -Infinity
    return ((item.totalAmount - prevItem.totalAmount) / prevItem.totalAmount) * 100
  }

  // Sort data based on selected column
  const getSortedData = () => {
    if (!data || data.length === 0) return []

    return [...data].sort((a, b) => {
      let aVal, bVal

      if (sortBy === 'yoyCountChange') {
        aVal = getYoYCountChange(a)
        bVal = getYoYCountChange(b)
      } else if (sortBy === 'yoyAmountChange') {
        aVal = getYoYAmountChange(a)
        bVal = getYoYAmountChange(b)
      } else if (sortBy === 'avgTotal') {
        aVal = getAvgTotal(a)
        bVal = getAvgTotal(b)
      } else if (sortBy === 'avgPurchase') {
        aVal = getAvgPurchase(a)
        bVal = getAvgPurchase(b)
      } else if (sortBy === 'avgRefinance') {
        aVal = getAvgRefinance(a)
        bVal = getAvgRefinance(b)
      } else if (sortBy === 'medianTotal') {
        aVal = getMedianTotal(a)
        bVal = getMedianTotal(b)
      } else if (sortBy === 'medianPurchase') {
        aVal = getMedianPurchase(a)
        bVal = getMedianPurchase(b)
      } else if (sortBy === 'medianRefinance') {
        aVal = getMedianRefinance(a)
        bVal = getMedianRefinance(b)
      } else {
        aVal = a[sortBy] || 0
        bVal = b[sortBy] || 0
      }

      return bVal - aVal // Descending order
    })
  }

  const sortedData = getSortedData()

  const generatePDF = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'tabloid' })
    const title = getTableTitle()
    const sortLabel = SORT_OPTIONS.find(o => o.value === sortBy)?.label || ''

    // Title
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text(title, 40, 40)

    // Subtitle
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(
      `Retail/Broker/Non-Delegated Correspondent: Residential (1 to 4 Unit) Mortgage Originations  |  Year: ${selectedYear}  |  Sorted By: ${sortLabel}`,
      40, 58
    )

    // Table headers
    const headers = [
      [
        { content: 'Rank', rowSpan: 2 },
        { content: getViewLabel(), rowSpan: 2 },
        { content: 'Total Originations Volume', colSpan: 8 },
        { content: 'Purchase Originations Volume', colSpan: 6 },
        { content: 'Refinance Originations Volume', colSpan: 6 }
      ],
      [
        '#', '% of #', 'YoY %Δ #', '$000s', 'Avg $000s', 'Median $000s', '% of $', 'YoY %Δ $',
        '#', '% of #', '$000s', 'Avg $000s', 'Median $000s', '% of $',
        '#', '% of #', '$000s', 'Avg $000s', 'Median $000s', '% of $'
      ]
    ]

    // Table body
    const body = sortedData.map((item, index) => {
      const itemKey = getItemKey(item)
      const yoyCount = calculateYoYChange(item.totalCount, itemKey)
      const yoyAmount = calculateYoYAmountChange(item.totalAmount, itemKey)

      return [
        index + 1,
        getItemName(item),
        formatNumber(item.totalCount),
        formatPercent(item.totalPctCount),
        formatChange(yoyCount),
        formatCurrency(item.totalAmount),
        formatCurrency(getAvgTotal(item)),
        formatCurrency(getMedianTotal(item)),
        formatPercent(item.totalPctAmount),
        formatChange(yoyAmount),
        formatNumber(item.purchaseCount),
        formatPercent(item.purchasePctCount),
        formatCurrency(item.purchaseAmount),
        formatCurrency(getAvgPurchase(item)),
        formatCurrency(getMedianPurchase(item)),
        formatPercent(item.purchasePctAmount),
        formatNumber(item.refinanceCount),
        formatPercent(item.refinancePctCount),
        formatCurrency(item.refinanceAmount),
        formatCurrency(getAvgRefinance(item)),
        formatCurrency(getMedianRefinance(item)),
        formatPercent(item.refinancePctAmount)
      ]
    })

    autoTable(doc, {
      head: headers,
      body: body,
      startY: 70,
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 3, halign: 'right' },
      headStyles: { fillColor: [26, 32, 44], textColor: 255, halign: 'center', fontSize: 7 },
      columnStyles: {
        0: { halign: 'center', cellWidth: 30 },
        1: { halign: 'left', cellWidth: 140 }
      },
      didParseCell: (data) => {
        // Highlight YoY columns
        if (data.section === 'body') {
          if (data.column.index === 4 || data.column.index === 9) {
            const val = data.cell.raw
            if (typeof val === 'string' && val.startsWith('+')) {
              data.cell.styles.textColor = [5, 150, 105]
            } else if (typeof val === 'string' && val.startsWith('-')) {
              data.cell.styles.textColor = [220, 38, 38]
            }
          }
        }
      }
    })

    // Footer
    const pageCount = doc.internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'italic')
      doc.setTextColor(128)
      doc.text(
        'Source: HMDA Data (FFIEC) | Generated from HMDA Graphical Reports Dashboard',
        40, doc.internal.pageSize.height - 20
      )
      doc.text(
        `Page ${i} of ${pageCount}`,
        doc.internal.pageSize.width - 100, doc.internal.pageSize.height - 20
      )
    }

    doc.save(`${title.replace(/\s+/g, '_')}_${selectedYear}.pdf`)
  }

  return (
    <div className="top-metros-section">
      <div className="metros-header">
        <div>
          <h2>{getTableTitle()}</h2>
          <p className="metros-subtitle">
            Retail/Broker/Non-Delegated Correspondent: Residential (1 to 4 Unit) Mortgage Originations
          </p>
        </div>
        <div className="table-controls">
          <div className="view-selector">
            <label htmlFor="view-type">View By:</label>
            <select
              id="view-type"
              value={viewType}
              onChange={(e) => setViewType(e.target.value)}
              className="view-select"
            >
              <option value="msa">Metro Market</option>
              <option value="state">State</option>
              <option value="lender">Lender</option>
            </select>
          </div>
          <div className="year-selector">
            <label htmlFor="metro-year">Year:</label>
            <select
              id="metro-year"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="year-select"
            >
              <option value="2023">2023</option>
              <option value="2024">2024</option>
            </select>
          </div>
          <div className="sort-selector">
            <label htmlFor="sort-by">Sort By:</label>
            <select
              id="sort-by"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="sort-select"
            >
              {SORT_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="metros-loading">Loading {getViewLabel()} data...</div>
      ) : error ? (
        <div className="metros-error">{error}</div>
      ) : (
        <>
          <div className="pdf-export">
            <a href="#" className="pdf-link" onClick={(e) => { e.preventDefault(); generatePDF() }}>
              Download as PDF
            </a>
          </div>
          <div className="table-wrapper">
            <table className="metros-table">
              <thead>
                <tr>
                  <th rowSpan="2">Rank</th>
                  <th rowSpan="2">{getViewLabel()}</th>
                  <th colSpan="8">Total Originations Volume</th>
                  <th colSpan="6">Purchase Originations Volume</th>
                  <th colSpan="6">Refinance Originations Volume</th>
                </tr>
                <tr>
                  {/* Total */}
                  <th>#</th>
                  <th>% of #</th>
                  <th className="yoy-header">YoY %Δ #</th>
                  <th>$000s</th>
                  <th>Avg $000s</th>
                  <th>Median $000s</th>
                  <th>% of $</th>
                  <th className="yoy-header">YoY %Δ $</th>
                  {/* Purchase */}
                  <th>#</th>
                  <th>% of #</th>
                  <th>$000s</th>
                  <th>Avg $000s</th>
                  <th>Median $000s</th>
                  <th>% of $</th>
                  {/* Refinance */}
                  <th>#</th>
                  <th>% of #</th>
                  <th>$000s</th>
                  <th>Avg $000s</th>
                  <th>Median $000s</th>
                  <th>% of $</th>
                </tr>
              </thead>
              <tbody>
                {sortedData.map((item, index) => {
                  const itemKey = getItemKey(item)
                  const yoyCountChange = calculateYoYChange(item.totalCount, itemKey)
                  const yoyAmountChange = calculateYoYAmountChange(item.totalAmount, itemKey)

                  return (
                    <tr key={itemKey}>
                      <td className="rank-cell">{index + 1}</td>
                      <td className="name-cell">{getItemName(item)}</td>
                      {/* Total */}
                      <td className="number-cell">{formatNumber(item.totalCount)}</td>
                      <td className="percent-cell">{formatPercent(item.totalPctCount)}</td>
                      <td className={`yoy-cell ${yoyCountChange >= 0 ? 'positive' : 'negative'}`}>
                        {formatChange(yoyCountChange)}
                      </td>
                      <td className="currency-cell">{formatCurrency(item.totalAmount)}</td>
                      <td className="currency-cell">{formatCurrency(getAvgTotal(item))}</td>
                      <td className="currency-cell">{formatCurrency(getMedianTotal(item))}</td>
                      <td className="percent-cell">{formatPercent(item.totalPctAmount)}</td>
                      <td className={`yoy-cell ${yoyAmountChange >= 0 ? 'positive' : 'negative'}`}>
                        {formatChange(yoyAmountChange)}
                      </td>
                      {/* Purchase */}
                      <td className="number-cell">{formatNumber(item.purchaseCount)}</td>
                      <td className="percent-cell">{formatPercent(item.purchasePctCount)}</td>
                      <td className="currency-cell">{formatCurrency(item.purchaseAmount)}</td>
                      <td className="currency-cell">{formatCurrency(getAvgPurchase(item))}</td>
                      <td className="currency-cell">{formatCurrency(getMedianPurchase(item))}</td>
                      <td className="percent-cell">{formatPercent(item.purchasePctAmount)}</td>
                      {/* Refinance */}
                      <td className="number-cell">{formatNumber(item.refinanceCount)}</td>
                      <td className="percent-cell">{formatPercent(item.refinancePctCount)}</td>
                      <td className="currency-cell">{formatCurrency(item.refinanceAmount)}</td>
                      <td className="currency-cell">{formatCurrency(getAvgRefinance(item))}</td>
                      <td className="currency-cell">{formatCurrency(getMedianRefinance(item))}</td>
                      <td className="percent-cell">{formatPercent(item.refinancePctAmount)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="table-notes">
            <h4>Notes:</h4>
            <ol>
              <li>Home Mortgage Disclosure Act (HMDA) data are sourced from the FFIEC website. Visit www.ffiec.gov/hmda for details on data exemptions and disclosures.</li>
              <li>These summary statistics include 1-4 unit 'closed-end' (or exempt) loans with an action type of 'originated' (no purchased loans) that are 'secured by a first lien' and exclude 'home improvement' loans or loans with 'other' and 'not applicable' purposes.</li>
              <li>Subsidiary lenders have been consolidated under parent institutions where possible, though some exceptions may apply. This data is provided as is with no warranties of any kind.</li>
              {viewType === 'lender' && (
                <li>Lenders are identified by their Legal Entity Identifier (LEI). LEI to company name mapping may be available from external sources.</li>
              )}
            </ol>
          </div>
        </>
      )}
    </div>
  )
}

export default TopMetrosTable
