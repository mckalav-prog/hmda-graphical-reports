import React from 'react'
import './DataTable.css'

const DataTable = ({ data }) => {
  if (!data || data.length === 0) {
    return <p>No data available</p>
  }

  const headers = Object.keys(data[0])

  return (
    <div className="table-container">
      <table className="data-table">
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {headers.map((header) => (
                <td key={header}>
                  {typeof row[header] === 'number'
                    ? row[header].toLocaleString()
                    : row[header]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default DataTable
