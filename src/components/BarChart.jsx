import React from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const BarChartComponent = ({ data }) => {
  const getNumericKeys = () => {
    if (!data || data.length === 0) return []
    const firstRow = data[0]
    return Object.keys(firstRow).filter(key => key !== 'name' && typeof firstRow[key] === 'number')
  }

  const getCategoryKey = () => {
    if (!data || data.length === 0) return null
    return 'name'
  }

  const numericKeys = getNumericKeys()
  const categoryKey = getCategoryKey()
  const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1']

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey={categoryKey} />
        <YAxis />
        <Tooltip />
        <Legend />
        {numericKeys.map((key, index) => (
          <Bar key={key} dataKey={key} fill={colors[index % colors.length]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

export default BarChartComponent
