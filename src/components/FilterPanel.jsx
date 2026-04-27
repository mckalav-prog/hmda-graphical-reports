import './FilterPanel.css'

const FilterPanel = ({
  selectedYear,
  setSelectedYear,
  selectedState,
  setSelectedState,
  selectedView,
  setSelectedView,
  availableYears,
  availableStates,
  onLoadData,
  loading
}) => {
  return (
    <div className="filter-panel">
      <div className="filter-group">
        <label htmlFor="view-select">View:</label>
        <select
          id="view-select"
          value={selectedView}
          onChange={(e) => setSelectedView(e.target.value)}
          className="filter-select"
        >
          <option value="by-state">By State</option>
          <option value="by-loan-purpose">By Loan Purpose</option>
          <option value="by-loan-type">By Loan Type</option>
        </select>
      </div>

      <div className="filter-group">
        <label htmlFor="year-select">Year:</label>
        <select
          id="year-select"
          value={selectedYear}
          onChange={(e) => setSelectedYear(e.target.value)}
          className="filter-select"
        >
          <option value="all">All Years</option>
          {availableYears.map(year => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
      </div>

      <div className="filter-group">
        <label htmlFor="state-select">State:</label>
        <select
          id="state-select"
          value={selectedState}
          onChange={(e) => setSelectedState(e.target.value)}
          className="filter-select"
        >
          <option value="all">All States</option>
          {availableStates.map(state => (
            <option key={state} value={state}>{state}</option>
          ))}
        </select>
      </div>

      <button
        onClick={onLoadData}
        className="load-button"
        disabled={loading}
      >
        {loading ? 'Loading...' : 'Load Data'}
      </button>
    </div>
  )
}

export default FilterPanel
