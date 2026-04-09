import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../api/axios'
import { endpoints } from '../api/endpoints'
import { useBulkRemoveAlgorithms, useImportAvailableAlgorithms, useRemoveAlgorithmWithFile } from '../api/hooks'
import { Link } from 'react-router-dom'

type Algo = { id: number; name?: string | null; description?: string | null; fileName?: string | null }

export default function Algorithms(){
  const { data, isLoading, isError } = useQuery<{ items: Algo[] } | Algo[]>({
    queryKey: ['algorithms'],
    queryFn: async () => {
      const { data } = await api.get(endpoints.algorithms.list)
      return data as Algo[]
    },
  })
  const rawAlgos: Algo[] = useMemo(() => {
    if (Array.isArray(data)) return data as Algo[]
    if (data && Array.isArray((data as any).items)) return (data as any).items as Algo[]
    return []
  }, [data])

  // Deduplicate algorithms to prevent stale duplicates (same JAR/name) from older caches
  const algos: Algo[] = useMemo(() => dedupeAlgorithms(rawAlgos), [rawAlgos])

  const importAlgos = useImportAvailableAlgorithms()
  const removeAlgo = useRemoveAlgorithmWithFile()
  const bulkRemove = useBulkRemoveAlgorithms()
  if (isLoading) return <div>Loading…</div>
  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Algorithms</h1>
        <div className="flex items-center gap-3">
          <Link to="/algorithms/upload" className="text-sm text-white bg-primary px-3 py-1.5 rounded-md hover:opacity-90">Upload</Link>
          <button
            onClick={() => importAlgos.mutate(undefined)}
            disabled={importAlgos.isPending}
            className="text-sm px-3 py-1.5 rounded-md border border-gray-300 hover:bg-white disabled:opacity-60"
            title="Scan algorithms folder and import into database"
          >
            {importAlgos.isPending ? 'Scanning…' : 'Scan & import'}
          </button>
          <button
            onClick={() => {
              if (algos.length === 0) return
              const ok1 = window.confirm(`Remove ALL ${algos.length} algorithms and delete their JAR files from disk?`)
              const ok2 = ok1 && window.confirm('This action cannot be undone. Are you absolutely sure?')
              if (ok2) bulkRemove.mutate()
            }}
            disabled={bulkRemove.isPending || algos.length === 0}
            className="text-sm px-3 py-1.5 rounded-md border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-60"
            title="Delete all registered algorithms and their JAR files"
          >
            {bulkRemove.isPending ? 'Removing…' : 'Remove all'}
          </button>
        </div>
      </div>
  {/* Tip removed: Deregister option hidden per requirements */}
      {isError && (
        <div className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Could not load algorithms. Ensure the backend is running.
        </div>
      )}
      {importAlgos.isSuccess && (
        <div className="mt-3 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          Imported {importAlgos.data.success} algorithms
          {importAlgos.data.failed > 0 && (
            <>
              {` ; ${importAlgos.data.failed} failed:`}
              <ul className="mt-1 list-disc list-inside">
                {importAlgos.data.details.filter(d => !d.ok).slice(0,3).map((d, i) => (
                  <li key={i}><span className="font-mono">{d.file}</span>: {d.error}</li>
                ))}
                {importAlgos.data.failed > 3 && <li>… and more</li>}
              </ul>
            </>
          )}
        </div>
      )}
      {(!data || algos.length === 0) ? (
        <ul className="mt-4 space-y-2">
          <li className="text-center text-muted">No algorithms available</li>
        </ul>
      ) : (
        <ul className="mt-4 space-y-2">
          {algos.map((a: Algo) => (
            <li key={a.id} className="bg-white p-3 rounded-md shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{a.name || a.fileName || 'Unnamed algorithm'}</div>
                  {a.description && <div className="text-sm text-muted">{a.description}</div>}
                  {a.fileName && <div className="text-xs text-muted mt-1">{a.fileName}</div>}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="text-xs px-2 py-1 rounded-md border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-60"
                    onClick={() => {
                      if (removeAlgo.isPending) return
                      const displayName = a.name || a.fileName || 'this algorithm'
                      const ok = window.confirm(`Remove algorithm "${displayName}" and delete its JAR file from disk?`)
                      if (ok) removeAlgo.mutate(a.id)
                    }}
                    disabled={removeAlgo.isPending}
                    title="Delete from registry and remove JAR file"
                  >
                    {removeAlgo.isPending ? 'Removing…' : 'Remove'}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function dedupeAlgorithms(list: Algo[]): Algo[] {
  const byKey = new Map<string, Algo>()
  for (const algo of list) {
    const baseKey = (algo.fileName || algo.name || `id:${algo.id}` || '').trim().toLowerCase()
    const key = baseKey || `id:${algo.id}`
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, algo)
      continue
    }
    const preferNewer = (algo.id ?? 0) > (existing.id ?? 0)
    const preferDetailed = !!algo.description && !existing.description
    if (preferNewer || preferDetailed) {
      byKey.set(key, algo)
    }
  }
  return Array.from(byKey.values())
}

