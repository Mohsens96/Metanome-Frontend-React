import React from 'react'
import { useParams } from 'react-router-dom'
import { useProfilingResult } from '../api/hooks'

export default function ResultsOverview() {
  const { id } = useParams()
  const { data, isLoading } = useProfilingResult(id)

  if (isLoading) return <div>Loading results…</div>
  if (!data) return <div>No results</div>

  return (
    <div>
      <h1 className="text-xl font-semibold">Results for execution {data.executionId}</h1>
      <p className="text-sm text-muted">Rows: {data.rows} — Runtime: {data.runTimeMs}ms</p>
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.columns.map((c) => (
          <div key={c.name} className="bg-white p-4 rounded-md shadow-sm">
            <h3 className="font-medium">{c.name}</h3>
            <p className="text-sm text-muted">Type: {c.type} — Distinct: {c.distinctCount} — Missing: {c.missing}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
