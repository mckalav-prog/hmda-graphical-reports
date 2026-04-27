import React from 'react'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const PieChartComponent = ({ data }) => {
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658']

  const getPieData = () => {
    if (!data || data.length === 0) return []

    const firstRow = data[0]
    const categoryKey = Object.keys(firstRow).find(key => typeof firstRow[key] === 'string')

    // Prefer 'Loan Count' or first numeric key
    let numericKey = 'Loan Count'
    if (!firstRow[numericKey]) {
      numericKey = Object.keys(firstRow).find(key => typeof firstRow[key] === 'number')
    }

    if (!categoryKey || !numericKey) return []

    return data.map(item => ({
      name: item[categoryKey],
      value: Math.abs(item[numericKey] || 0)
    }))
  }

  const pieData = getPieData()

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={pieData}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
          outerRadius={80}
          fill="#8884d8"
          dataKey="value"
        >
          {pieData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  )
}

export default PieChartComponent
