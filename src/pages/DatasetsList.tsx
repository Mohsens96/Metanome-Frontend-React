import React from 'react'
import Table from '../components/Table'
import { useFileInputs, useUploadSampleDataset, useDeleteFileInput } from '../api/hooks'
import { Link, useLocation } from 'react-router-dom'
import api from '../api/axios'
import { endpoints } from '../api/endpoints'
import type { FileInput } from '../api/types'

export default function DatasetsList() {
  const location = useLocation()
  const { data, isLoading, isError, refetch } = useFileInputs()
  const rows = (data ?? []) as FileInput[]
  const uploadSample = useUploadSampleDataset()
  const deleteDataset = useDeleteFileInput()
  const [removeAllPending, setRemoveAllPending] = React.useState(false)
  const [deleteError, setDeleteError] = React.useState<string | null>(null)

  const badDatasets = (location.state as any)?.badDatasets as Array<{ id: number; name: string; fileName?: string }> | undefined

  const [autoCheckBad, setAutoCheckBad] = React.useState<Array<{ id: number; name: string }>>([])
  const autoCheckRanForIds = React.useRef<Set<number>>(new Set())

  const getCsvName = (r: FileInput) => {
    const base = r.fileName?.split(/[/\\]/).pop() || ''
    return base.endsWith('.csv') ? base : (r.name && r.name.endsWith('.csv') ? r.name : base)
  }

  // Auto-check: whenever user opens Datasets overview, detect datasets that can't be previewed.
  React.useEffect(() => {
    if (isLoading) return
    if (!Array.isArray(rows) || rows.length === 0) {
      setAutoCheckBad([])
      return
    }
    let cancelled = false
    const run = async () => {
      const bad: Array<{ id: number; name: string }> = []
      const toCheck = rows.filter((r) => r?.id > 0 && !autoCheckRanForIds.current.has(r.id))
      if (toCheck.length === 0) return
      for (const r of toCheck) {
        if (cancelled) return
        autoCheckRanForIds.current.add(r.id)
        try {
          await api.get(endpoints.fileInputs.preview(r.id, 2))
        } catch {
          bad.push({ id: r.id, name: getCsvName(r) || r.name || String(r.id) })
        }
      }
      if (!cancelled && bad.length > 0) {
        setAutoCheckBad((prev) => {
          const map = new Map<number, { id: number; name: string }>()
          for (const p of prev) map.set(p.id, p)
          for (const b of bad) map.set(b.id, b)
          return Array.from(map.values())
        })
      }
    }
    run()
    return () => { cancelled = true }
  }, [isLoading, rows])

  if (isLoading) return <div>Loading...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Datasets</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-700">{rows.length} total</span>
          {rows.length > 0 && (
            <button
              onClick={async () => {
                if (removeAllPending || deleteDataset.isPending) return
                const ok = window.confirm(`Delete ALL datasets (${rows.length})? This cannot be undone.`)
                if (!ok) return
                setDeleteError(null)
                setRemoveAllPending(true)
                let failed = 0
                try {
                  for (const r of rows) {
                    if (!r?.id || r.id <= 0) continue
                    try {
                      await deleteDataset.mutateAsync(r.id)
                    } catch (e) {
                      failed += 1
                      console.error('Delete dataset failed', r?.id, e)
                    }
                  }
                } finally {
                  setRemoveAllPending(false)
                  await refetch()
                }
                if (failed > 0) {
                  setDeleteError(`Failed to delete ${failed} dataset(s).`)
                }
              }}
              disabled={removeAllPending || deleteDataset.isPending}
              className="text-sm px-3 py-1.5 rounded-md border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-60"
              title="Delete all datasets"
            >
              {removeAllPending ? 'Removing…' : 'Remove all'}
            </button>
          )}
          <Link to="/upload" className="text-sm text-white bg-primary px-3 py-1.5 rounded-md hover:opacity-90">Upload</Link>
        </div>
      </div>

      {isError && (
        <div className="mb-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Could not load datasets. Please ensure the backend is running on VITE_API_URL and try again.
        </div>
      )}

      {deleteError && (
        <div className="mb-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {deleteError}
        </div>
      )}

      {Array.isArray(badDatasets) && badDatasets.length > 0 && (
        <div className="mb-3 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <div className="font-medium">Some uploaded files need datasource settings</div>
          <div className="mt-1">These datasets could not be previewed with the default settings. Open each one and adjust separator/quote/header.</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {badDatasets.map((d, idx) => (
              d.id > 0 ? (
                <Link
                  key={`${d.id}-${idx}`}
                  to={`/datasets/${d.id}`}
                  className="text-xs px-2 py-1 rounded-md border border-amber-300 hover:bg-white"
                >
                  {d.name}
                </Link>
              ) : (
                <span key={`missing-${idx}`} className="text-xs px-2 py-1 rounded-md border border-amber-300">
                  {d.name}
                </span>
              )
            ))}
          </div>
        </div>
      )}

      {autoCheckBad.length > 0 && (
        <div className="mb-3 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <div className="font-medium">Some datasets need datasource settings</div>
          <div className="mt-1">These datasets could not be previewed with the current settings. Open each one and adjust separator/quote/header.</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {autoCheckBad.map((d) => (
              <Link
                key={d.id}
                to={`/datasets/${d.id}`}
                className="text-xs px-2 py-1 rounded-md border border-amber-300 hover:bg-white"
              >
                {d.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
          <div className="font-medium text-gray-800">No datasets yet</div>
          <div className="mt-1 text-gray-600">Use the Upload button to add a dataset, or drop a CSV into the server's input directory.</div>
          <div className="mt-3">
            <Link to="/upload" className="inline-flex items-center text-sm text-white bg-primary px-3 py-1.5 rounded-md hover:opacity-90">
              Upload dataset
            </Link>
            <button
              onClick={() => uploadSample.mutate()}
              disabled={uploadSample.isPending}
              className="ml-3 inline-flex items-center text-sm px-3 py-1.5 rounded-md border border-gray-300 hover:bg-white disabled:opacity-60"
            >
              {uploadSample.isPending ? 'Adding sample…' : 'Add sample dataset'}
            </button>
            {uploadSample.isError && (
              <div className="mt-2 text-sm text-red-700">Could not add sample dataset.</div>
            )}
          </div>
        </div>
      ) : (
        <Table
          columns={[
            {
              key: 'name',
              title: 'Name',
              render: (r) => {
                // Only show the basename that ends with .csv (if present). If fileName has another extension, fall back to original logic.
                const base = r.fileName?.split(/[/\\]/).pop() || ''
                const csvName = base.endsWith('.csv') ? base : (r.name && r.name.endsWith('.csv') ? r.name : base)
                return (
                  <Link to={`/datasets/${r.id}`}>
                    {csvName || '(unnamed)'}
                  </Link>
                )
              },
            },
            {
              key: 'fileName',
              title: 'File',
              render: (r) => r.fileName || '—',
            },
            {
              key: 'actions',
              title: 'Actions',
              render: (r) => (
                <button
                  onClick={() => {
                    if (deleteDataset.isPending || removeAllPending || !r?.id || r.id <= 0) return
                    const base = r.fileName?.split(/[/\\]/).pop() || ''
                    const csvName = base.endsWith('.csv') ? base : (r.name && r.name.endsWith('.csv') ? r.name : base)
                    const ok = window.confirm(`Delete dataset "${csvName || r.name || r.id}"? This cannot be undone.`)
                    if (!ok) return
                    setDeleteError(null)
                    deleteDataset
                      .mutateAsync(r.id)
                      .then(() => refetch())
                      .catch((e) => {
                        console.error('Delete dataset failed', e)
                        setDeleteError('Delete failed. Please try again.')
                      })
                  }}
                  disabled={deleteDataset.isPending || removeAllPending || !r?.id || r.id <= 0}
                  className="text-xs px-2 py-1 rounded-md border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50"
                  title="Delete dataset"
                >
                  {deleteDataset.isPending ? 'Deleting…' : 'Delete'}
                </button>
              ),
            },
          ]}
          data={rows}
        />
      )}
    </div>
  )
}
