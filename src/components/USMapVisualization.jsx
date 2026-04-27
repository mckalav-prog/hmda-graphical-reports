import { useState, useEffect, useRef } from 'react'
import * as d3 from 'd3'
import * as topojson from 'topojson-client'
import './USMapVisualization.css'

// State FIPS to abbreviation mapping
const FIPS_TO_STATE = {
  '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA',
  '08': 'CO', '09': 'CT', '10': 'DE', '11': 'DC', '12': 'FL',
  '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL', '18': 'IN',
  '19': 'IA', '20': 'KS', '21': 'KY', '22': 'LA', '23': 'ME',
  '24': 'MD', '25': 'MA', '26': 'MI', '27': 'MN', '28': 'MS',
  '29': 'MO', '30': 'MT', '31': 'NE', '32': 'NV', '33': 'NH',
  '34': 'NJ', '35': 'NM', '36': 'NY', '37': 'NC', '38': 'ND',
  '39': 'OH', '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI',
  '45': 'SC', '46': 'SD', '47': 'TN', '48': 'TX', '49': 'UT',
  '50': 'VT', '51': 'VA', '53': 'WA', '54': 'WV', '55': 'WI',
  '56': 'WY', '72': 'PR'
}

const STATE_NAMES = {
  'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
  'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'DC': 'District of Columbia',
  'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois',
  'IN': 'Indiana', 'IA': 'Iowa', 'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana',
  'ME': 'Maine', 'MD': 'Maryland', 'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota',
  'MS': 'Mississippi', 'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada',
  'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York',
  'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma', 'OR': 'Oregon',
  'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina', 'SD': 'South Dakota',
  'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont', 'VA': 'Virginia',
  'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming', 'PR': 'Puerto Rico'
}

const USMapVisualization = () => {
  const svgRef = useRef(null)
  const tooltipRef = useRef(null)
  const [stateData, setStateData] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [usTopology, setUsTopology] = useState(null)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (usTopology && Object.keys(stateData).length > 0) {
      renderMap()
    }
  }, [usTopology, stateData])

  const loadData = async () => {
    try {
      setLoading(true)
      setError('')

      // Load US topology
      const topoResponse = await fetch('https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json')
      if (!topoResponse.ok) throw new Error('Failed to load US map data')
      const topoData = await topoResponse.json()
      setUsTopology(topoData)

      // Load state data
      const dataResponse = await fetch(`${import.meta.env.BASE_URL}data/by-state.json`)
      if (!dataResponse.ok) throw new Error('Failed to load state data')
      const jsonData = await dataResponse.json()

      // Calculate YoY change for each state
      const yoyData = {}
      const currentYear = '2024'
      const previousYear = '2023'

      if (jsonData[currentYear] && jsonData[previousYear]) {
        // Create lookup for previous year
        const prevYearMap = {}
        jsonData[previousYear].forEach(item => {
          prevYearMap[item.state] = item
        })

        // Calculate YoY for each state in current year
        jsonData[currentYear].forEach(item => {
          const prevItem = prevYearMap[item.state]
          if (prevItem && prevItem.totalCount > 0) {
            const yoyChange = ((item.totalCount - prevItem.totalCount) / prevItem.totalCount) * 100
            yoyData[item.state] = {
              yoyChange,
              currentCount: item.totalCount,
              previousCount: prevItem.totalCount,
              currentAmount: item.totalAmount,
              previousAmount: prevItem.totalAmount
            }
          }
        })
      }

      setStateData(yoyData)
    } catch (err) {
      console.error('Error loading data:', err)
      setError('Unable to load map data')
    } finally {
      setLoading(false)
    }
  }

  const renderMap = () => {
    if (!svgRef.current || !usTopology) return

    // Clear previous content
    d3.select(svgRef.current).selectAll('*').remove()

    const width = 960
    const height = 600
    const margin = { top: 20, right: 20, bottom: 20, left: 20 }

    const svg = d3.select(svgRef.current)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('preserveAspectRatio', 'xMidYMid meet')

    // Create projection
    const projection = d3.geoAlbersUsa()
      .scale(1200)
      .translate([width / 2, height / 2])

    const path = d3.geoPath().projection(projection)

    // Get YoY values for color scale
    const yoyValues = Object.values(stateData).map(d => d.yoyChange)
    const maxAbs = Math.max(Math.abs(d3.min(yoyValues) || 0), Math.abs(d3.max(yoyValues) || 0), 20)

    // Diverging color scale (red for negative, green for positive)
    const colorScale = d3.scaleDiverging()
      .domain([-maxAbs, 0, maxAbs])
      .interpolator(d3.interpolateRdYlGn)

    // Convert topology to GeoJSON
    const states = topojson.feature(usTopology, usTopology.objects.states)

    // Create tooltip
    const tooltip = d3.select(tooltipRef.current)

    // Draw states
    svg.append('g')
      .selectAll('path')
      .data(states.features)
      .enter()
      .append('path')
      .attr('d', path)
      .attr('fill', d => {
        const fips = d.id.toString().padStart(2, '0')
        const stateAbbr = FIPS_TO_STATE[fips]
        const data = stateData[stateAbbr]
        if (data) {
          return colorScale(data.yoyChange)
        }
        return '#27272a'
      })
      .attr('stroke', '#3f3f46')
      .attr('stroke-width', 0.5)
      .style('cursor', 'pointer')
      .on('mouseover', function(event, d) {
        const fips = d.id.toString().padStart(2, '0')
        const stateAbbr = FIPS_TO_STATE[fips]
        const stateName = STATE_NAMES[stateAbbr] || stateAbbr
        const data = stateData[stateAbbr]

        d3.select(this)
          .attr('stroke', '#fafafa')
          .attr('stroke-width', 2)

        if (data) {
          const sign = data.yoyChange >= 0 ? '+' : ''
          tooltip
            .style('opacity', 1)
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 10) + 'px')
            .html(`
              <div class="tooltip-title">${stateName}</div>
              <div class="tooltip-row">
                <span class="tooltip-label">YoY Change:</span>
                <span class="tooltip-value ${data.yoyChange >= 0 ? 'positive' : 'negative'}">${sign}${data.yoyChange.toFixed(1)}%</span>
              </div>
              <div class="tooltip-row">
                <span class="tooltip-label">2024 Volume:</span>
                <span class="tooltip-value">${data.currentCount.toLocaleString()}</span>
              </div>
              <div class="tooltip-row">
                <span class="tooltip-label">2023 Volume:</span>
                <span class="tooltip-value">${data.previousCount.toLocaleString()}</span>
              </div>
            `)
        } else {
          tooltip
            .style('opacity', 1)
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 10) + 'px')
            .html(`
              <div class="tooltip-title">${stateName}</div>
              <div class="tooltip-row">
                <span class="tooltip-label">No data available</span>
              </div>
            `)
        }
      })
      .on('mousemove', function(event) {
        tooltip
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 10) + 'px')
      })
      .on('mouseout', function() {
        d3.select(this)
          .attr('stroke', '#3f3f46')
          .attr('stroke-width', 0.5)

        tooltip.style('opacity', 0)
      })

    // Draw state borders
    svg.append('path')
      .datum(topojson.mesh(usTopology, usTopology.objects.states, (a, b) => a !== b))
      .attr('fill', 'none')
      .attr('stroke', '#3f3f46')
      .attr('stroke-width', 0.5)
      .attr('d', path)

    // Add legend
    const legendWidth = 300
    const legendHeight = 12
    const legendX = width - legendWidth - 40
    const legendY = height - 60

    // Create gradient for legend
    const defs = svg.append('defs')
    const linearGradient = defs.append('linearGradient')
      .attr('id', 'legend-gradient')
      .attr('x1', '0%')
      .attr('x2', '100%')

    const numStops = 10
    for (let i = 0; i <= numStops; i++) {
      const t = i / numStops
      const value = -maxAbs + (2 * maxAbs * t)
      linearGradient.append('stop')
        .attr('offset', `${t * 100}%`)
        .attr('stop-color', colorScale(value))
    }

    // Legend background
    svg.append('rect')
      .attr('x', legendX - 10)
      .attr('y', legendY - 25)
      .attr('width', legendWidth + 20)
      .attr('height', 55)
      .attr('fill', '#18181b')
      .attr('rx', 8)

    // Legend title
    svg.append('text')
      .attr('x', legendX + legendWidth / 2)
      .attr('y', legendY - 8)
      .attr('text-anchor', 'middle')
      .attr('fill', '#a1a1aa')
      .attr('font-size', '11px')
      .attr('font-weight', '500')
      .text('YoY Growth in Origination Volume')

    // Legend bar
    svg.append('rect')
      .attr('x', legendX)
      .attr('y', legendY)
      .attr('width', legendWidth)
      .attr('height', legendHeight)
      .attr('fill', 'url(#legend-gradient)')
      .attr('rx', 2)

    // Legend axis
    const legendScale = d3.scaleLinear()
      .domain([-maxAbs, maxAbs])
      .range([0, legendWidth])

    const legendAxis = d3.axisBottom(legendScale)
      .ticks(5)
      .tickFormat(d => `${d >= 0 ? '+' : ''}${d.toFixed(0)}%`)

    svg.append('g')
      .attr('transform', `translate(${legendX}, ${legendY + legendHeight})`)
      .call(legendAxis)
      .selectAll('text')
      .attr('fill', '#a1a1aa')
      .attr('font-size', '10px')

    svg.selectAll('.domain, .tick line')
      .attr('stroke', '#52525b')
  }

  return (
    <div className="us-map-section">
      <div className="map-header">
        <h2>Year-over-Year Growth in Origination Volume by State</h2>
        <p className="map-subtitle">2024 vs 2023 - Total Mortgage Originations</p>
      </div>

      {loading ? (
        <div className="map-loading">Loading map data...</div>
      ) : error ? (
        <div className="map-error">{error}</div>
      ) : (
        <div className="map-container">
          <svg ref={svgRef}></svg>
          <div ref={tooltipRef} className="map-tooltip"></div>
        </div>
      )}

      <div className="map-footnote">
        Hover over states to see detailed year-over-year growth statistics
      </div>
    </div>
  )
}

export default USMapVisualization
