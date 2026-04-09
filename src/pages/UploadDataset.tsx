import React from 'react'
import Table from '../components/Table'
import { useUploadFile, useFileInputs, useDeleteFileInput, useAvailableInputFiles, useUpdateFileInput } from '../api/hooks'
import { useQuery } from '@tanstack/react-query'
import api from '../api/axios'
import { endpoints } from '../api/endpoints'
import type { FileInput } from '../api/types'
import { Link, useNavigate } from 'react-router-dom'

type FileInputSettings = {
  separator: string
  quoteChar: string
  escapeChar: string
  skipLines: number
  strictQuotes: boolean
  ignoreLeadingWhiteSpace: boolean
  hasHeader: boolean
  skipDifferingLines: boolean
  nullValue: string
}

export default function UploadDataset() {
  const upload = useUploadFile()
  const updateFileInput = useUpdateFileInput()
  const { data: rows = [], isLoading, refetch } = useFileInputs()
  const [lastAdded, setLastAdded] = React.useState<string | null>(null)
  const [uploadError, setUploadError] = React.useState<string | null>(null)
  const [deleteError, setDeleteError] = React.useState<string | null>(null)
  const [q, setQ] = React.useState('')
  const deleteDataset = useDeleteFileInput()
  const [removeAllPending, setRemoveAllPending] = React.useState(false)
  const [pendingRows, setPendingRows] = React.useState<Array<{ fileName: string; name?: string }>>([])
  const { refetch: refetchAvailable } = useAvailableInputFiles()
  const navigate = useNavigate()

  const [autoCheckBad, setAutoCheckBad] = React.useState<Array<{ id: number; name: string }>>([])
  const autoCheckRanForIds = React.useRef<Set<number>>(new Set())

  const singleInputRef = React.useRef<HTMLInputElement | null>(null)
  const multiInputRef = React.useRef<HTMLInputElement | null>(null)
  const [singleFile, setSingleFile] = React.useState<File | null>(null)
  const [singleSettingsOpen, setSingleSettingsOpen] = React.useState(false)
  const [singleSettings, setSingleSettings] = React.useState<FileInputSettings>({
    separator: ',',
    quoteChar: '"',
    escapeChar: '\\',
    skipLines: 0,
    strictQuotes: false,
    ignoreLeadingWhiteSpace: true,
    hasHeader: true,
    skipDifferingLines: false,
    nullValue: '',
  })

  // Clear optimistic placeholders once backend list contains them
  React.useEffect(() => {
    if (pendingRows.length === 0) return
    setPendingRows((prev) => prev.filter(p => {
      const csv = (p.fileName || p.name || '').toLowerCase()
      return !(rows as FileInput[]).some(r => (getCsvName(r) || '').toLowerCase() === csv)
    }))
  }, [rows])

  React.useEffect(() => {
    if (!lastAdded) return
    const timeout = window.setTimeout(() => setLastAdded(null), 4000)
    return () => window.clearTimeout(timeout)
  }, [lastAdded])

  const getCsvName = (r: FileInput) => {
    const base = r.fileName?.split(/[/\\]/).pop() || ''
    return base.endsWith('.csv') ? base : (r.name && r.name.endsWith('.csv') ? r.name : base)
  }

  const findDatasetForFileName = (list: FileInput[], fileName: string) => {
    const needle = (fileName || '').toLowerCase()
    return list.find((r) => (getCsvName(r) || '').toLowerCase() === needle) || null
  }

  const filteredRows = (rows as FileInput[]).filter((r) => {
    if (!q) return true
    const name = (getCsvName(r) || '').toLowerCase()
    return name.includes(q.toLowerCase())
  })

  // Merge optimistic pending items for immediate visibility
  const combinedRows: FileInput[] = React.useMemo(() => {
    const list = [...(filteredRows as FileInput[])]
    for (const p of pendingRows) {
      const csv = (p.fileName || p.name || '').split(/[/\\]/).pop() || ''
      const exists = list.some((r) => (getCsvName(r) || '').toLowerCase() === csv.toLowerCase())
      if (!exists && (!q || csv.toLowerCase().includes(q.toLowerCase()))) {
        list.unshift({ id: -Math.abs(Date.now()), name: p.name || csv, fileName: p.fileName || csv } as FileInput)
      }
    }
    return list
  }, [filteredRows, pendingRows, q])

  // Auto-check: whenever user opens Upload page, detect datasets that can't be previewed.
  React.useEffect(() => {
    if (isLoading) return
    const list = rows as FileInput[]
    if (!Array.isArray(list) || list.length === 0) {
      setAutoCheckBad([])
      return
    }

    let cancelled = false
    const run = async () => {
      const bad: Array<{ id: number; name: string }> = []
      // Limit checks per mount to avoid hammering the backend: only check unseen ids.
      const toCheck = list.filter((r) => r?.id > 0 && !autoCheckRanForIds.current.has(r.id))
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
        // Merge with any existing bad list (avoid duplicates)
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

  const handleFiles = async (files: File[], opts?: { afterRegistered?: (latest: FileInput[]) => Promise<void> }) => {
    const fd = new FormData()
    for (const file of files) {
      fd.append('file', file, file.name)
    }
    try {
      setUploadError(null)
      // Client-side duplicate check removed; backend will enforce unique constraints.
      // Add optimistic placeholder immediately
      setPendingRows((prev) => files.map((f) => ({ fileName: f.name })).concat(prev))
      const res = await upload.mutateAsync(fd)
      const lastFile = files[files.length - 1]
      // Try to capture a name hint from response or fallback to last selected file name
      const name = (res && (res.name || res.fileName)) || lastFile?.name
      setLastAdded(String(name || ''))
      // clear search so new row is visible
      setQ('')

      const normalizedNames = new Set(files.map((f) => (f.name || '').toLowerCase()))
      const ensureInList = (list: FileInput[] | undefined) =>
        Array.isArray(list) && list.some((r) => normalizedNames.has((getCsvName(r) || '').toLowerCase()))

      // Refetch now and check if backend already returned the dataset
      let latest: FileInput[] | undefined
      try {
        const result = await refetch()
        latest = (result?.data as FileInput[]) || undefined
      } catch (fetchErr) {
        console.error('Dataset refetch after upload failed', fetchErr)
      }

      // Fallback: if not visible yet, explicitly register via JSON endpoint using available files path
      if (!ensureInList(latest)) {
        try {
          const availableResult = await refetchAvailable()
          const availableList = (availableResult?.data as string[]) || []
          for (const file of files) {
            const normalizedName = (file.name || '').toLowerCase()
            const match = availableList.find((p) => p.toLowerCase().endsWith(normalizedName))
            if (match) {
              await api.post(endpoints.fileInputs.storeJson, {
                type: 'fileInput',
                name: file.name,
                fileName: match,
              })
              setPendingRows((prev) => prev.filter((p) => p.fileName !== file.name))
            } else {
              console.warn('Uploaded file not found in available list; manual import may be required')
              setUploadError('Upload succeeded, but some datasets are not yet listed. Try "Import available" or refresh shortly.')
              setPendingRows((prev) => prev.filter((p) => p.fileName !== file.name))
            }
          }
          const postStore = await refetch()
          latest = (postStore?.data as FileInput[]) || latest
        } catch (registerErr: any) {
          console.error('Register fallback failed', registerErr)
          setUploadError('Upload succeeded, but dataset could not be registered automatically.')
          const names = new Set(files.map((f) => f.name))
          setPendingRows((prev) => prev.filter((p) => !names.has(p.fileName)))
        }
      }

      const effectiveLatest = (latest || (rows as FileInput[])) as FileInput[]
      if (opts?.afterRegistered) {
        try {
          await opts.afterRegistered(effectiveLatest)
        } catch (e) {
          console.error('Post-upload handler failed', e)
        }
      }

      // Extra refetches to catch slower persistence or async jobs
      setTimeout(() => { refetch() }, 400)
      setTimeout(() => { refetch() }, 1500)
    } catch (e) {
      // Keep UI clean; optionally we could surface inline error message
      console.error('Upload failed', e)
      setUploadError('Upload failed. Please try again.')
      const names = new Set(files.map((f) => f.name))
      setPendingRows((prev) => prev.filter((p) => !names.has(p.fileName)))
    }
  }

  const openSingleSettings = (file: File) => {
    setSingleFile(file)
    setSingleSettingsOpen(true)
    setUploadError(null)
    // Keep defaults; user can edit
  }

  const uploadSingleWithSettings = async () => {
    if (!singleFile) return
    const file = singleFile
    const settings = singleSettings

    await handleFiles([file], {
      afterRegistered: async (latest) => {
        const ds = findDatasetForFileName(latest, file.name)
        if (!ds?.id || ds.id <= 0) {
          setUploadError('Upload succeeded, but dataset was not found for applying settings. Please go to Datasets and set settings there.')
          setSingleSettingsOpen(false)
          setSingleFile(null)
          return
        }
        await updateFileInput.mutateAsync({
          type: 'fileInput',
          id: ds.id,
          name: ds.name || file.name,
          fileName: ds.fileName,
          separator: settings.separator,
          quoteChar: settings.quoteChar,
          escapeChar: settings.escapeChar,
          skipLines: settings.skipLines,
          strictQuotes: settings.strictQuotes,
          ignoreLeadingWhiteSpace: settings.ignoreLeadingWhiteSpace,
          hasHeader: settings.hasHeader,
          skipDifferingLines: settings.skipDifferingLines,
          nullValue: settings.nullValue,
        } as any)

        setSingleSettingsOpen(false)
        setSingleFile(null)
        setLastAdded(file.name)
        await refetch()
      },
    })
  }

  const uploadMultipleAndCheck = async (files: File[]) => {
    await handleFiles(files, {
      afterRegistered: async (latest) => {
        const failures: Array<{ id: number; name: string; fileName?: string }> = []
        for (const f of files) {
          const ds = findDatasetForFileName(latest, f.name)
          if (!ds?.id || ds.id <= 0) {
            failures.push({ id: -1, name: f.name })
            continue
          }
          try {
            await api.get(endpoints.fileInputs.preview(ds.id, 5))
          } catch (e) {
            failures.push({ id: ds.id, name: f.name, fileName: ds.fileName })
          }
        }

        if (failures.length > 0) {
          // Navigate to datasets page and show which ones need settings.
          navigate('/datasets', { state: { badDatasets: failures } })
        }
      },
    })
  }

  return (
    <div>
      <h1 className="text-xl font-semibold">Upload dataset</h1>
      <div className="mt-4">
        <div className="flex items-center gap-3">
          <input
            ref={singleInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0] || null
              e.currentTarget.value = ''
              if (!f) return
              openSingleSettings(f)
            }}
          />
          <input
            ref={multiInputRef}
            type="file"
            accept=".csv,text/csv"
            multiple
            className="hidden"
            onChange={(e) => {
              const list = Array.from(e.target.files || [])
              e.currentTarget.value = ''
              if (list.length === 0) return
              uploadMultipleAndCheck(list)
            }}
          />

          <button
            onClick={() => singleInputRef.current?.click()}
            className="text-sm text-white bg-primary px-3 py-1.5 rounded-md hover:opacity-90"
            disabled={upload.isPending || updateFileInput.isPending}
          >
            Choose file
          </button>
          <button
            onClick={() => multiInputRef.current?.click()}
            className="text-sm px-3 py-1.5 rounded-md border border-gray-300 hover:bg-white disabled:opacity-60"
            disabled={upload.isPending || updateFileInput.isPending}
          >
            Choose files
          </button>
        </div>
      </div>
      {uploadError && (
        <div className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{uploadError}</div>
      )}
      {deleteError && (
        <div className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{deleteError}</div>
      )}

      {autoCheckBad.length > 0 && (
        <div className="mt-3 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
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
      {/* Inline success ping */}
      {upload.isSuccess && lastAdded && (
        <div className="mt-3 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          Added dataset: <span className="font-mono">{lastAdded}</span>
        </div>
      )}

      {/* Existing datasets table */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-2 gap-3">
          <h2 className="text-lg font-medium">Existing datasets</h2>
          <div className="flex items-center gap-2">
            {rows.length > 0 && (
              <button
                onClick={async () => {
                  if (removeAllPending || deleteDataset.isPending) return
                  const ok = window.confirm(`Delete ALL datasets (${rows.length})? This cannot be undone.`)
                  if (!ok) return
                  setDeleteError(null)
                  setRemoveAllPending(true)
                  // Clear optimistic placeholders immediately so UI reflects the intent
                  setPendingRows([])
                  let failed = 0
                  try {
                    for (const r of rows as FileInput[]) {
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
                className="text-xs px-2 py-1 rounded-md border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50"
                title="Delete all datasets"
              >
                {removeAllPending ? 'Removing…' : 'Remove all'}
              </button>
            )}
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name (.csv)"
              className="h-9 w-56 rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <span className="text-sm text-muted">{filteredRows.length} / {rows.length}</span>
          </div>
        </div>
        {isLoading ? (
          <div>Loading…</div>
        ) : rows.length === 0 ? (
          <div className="rounded-md border border-gray-200 bg-gray-50 p-4 text-sm text-muted">No datasets yet.</div>
        ) : (
          <Table<FileInput>
            columns={[
              {
                key: 'name',
                title: 'Name',
                render: (r) => {
                  const csvName = getCsvName(r)
                  return <span className={lastAdded && (csvName === lastAdded || r.name === lastAdded) ? 'font-medium text-primary' : ''}>{csvName || '(unnamed)'}</span>
                },
              },
              {
                key: 'stats',
                title: 'Rows / Cols',
                render: (r) => <DatasetRowStats id={r.id} fallbackCols={Array.isArray(r.columns) ? r.columns.length : undefined} />,
              },
              {
                key: 'actions',
                title: 'Actions',
                render: (r) => (
                  <button
                    onClick={() => {
                      if (deleteDataset.isPending || removeAllPending || r.id <= 0) return
                      const ok = window.confirm(`Delete dataset "${getCsvName(r) || r.name || r.id}"? This cannot be undone.`)
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
                    disabled={deleteDataset.isPending || removeAllPending || r.id <= 0}
                    className="text-xs px-2 py-1 rounded-md border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50"
                    title="Delete dataset"
                  >
                    {deleteDataset.isPending ? 'Deleting…' : 'Delete'}
                  </button>
                ),
              },
            ]}
            data={combinedRows}
            rowClassName={(r) => {
              const csvName = getCsvName(r)
              const isNew = !!lastAdded && (csvName === lastAdded || r.name === lastAdded)
              return isNew ? 'bg-amber-100 ring-2 ring-amber-400/80 shadow-sm transition' : ''
            }}
          />
        )}
      </div>

      {/* Single-file settings popup */}
      {singleSettingsOpen && singleFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-md bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium">Upload settings</div>
                <div className="text-xs text-muted mt-0.5">{singleFile.name}</div>
              </div>
              <button
                onClick={() => {
                  if (upload.isPending || updateFileInput.isPending) return
                  setSingleSettingsOpen(false)
                  setSingleFile(null)
                }}
                className="text-sm px-3 py-1.5 rounded-md border border-gray-300 hover:bg-white disabled:opacity-60"
                disabled={upload.isPending || updateFileInput.isPending}
              >
                Cancel
              </button>
            </div>

            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700">Separator</label>
                <input
                  value={singleSettings.separator}
                  onChange={(e) => setSingleSettings({ ...singleSettings, separator: e.target.value })}
                  className="mt-1 h-9 w-full rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="; or ,"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">Skip lines</label>
                <input
                  type="number"
                  min={0}
                  value={singleSettings.skipLines}
                  onChange={(e) => setSingleSettings({ ...singleSettings, skipLines: Number(e.target.value) })}
                  className="mt-1 h-9 w-full rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">Quote char</label>
                <input
                  value={singleSettings.quoteChar}
                  onChange={(e) => setSingleSettings({ ...singleSettings, quoteChar: e.target.value })}
                  className="mt-1 h-9 w-full rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder='"'
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">Escape char</label>
                <input
                  value={singleSettings.escapeChar}
                  onChange={(e) => setSingleSettings({ ...singleSettings, escapeChar: e.target.value })}
                  className="mt-1 h-9 w-full rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="\\"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-700">Null value</label>
                <input
                  value={singleSettings.nullValue}
                  onChange={(e) => setSingleSettings({ ...singleSettings, nullValue: e.target.value })}
                  className="mt-1 h-9 w-full rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="(empty string)"
                />
              </div>
              <div className="md:col-span-2 flex flex-wrap gap-4 pt-1">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={singleSettings.hasHeader}
                    onChange={(e) => setSingleSettings({ ...singleSettings, hasHeader: e.target.checked })}
                  />
                  Has header
                </label>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={singleSettings.ignoreLeadingWhiteSpace}
                    onChange={(e) => setSingleSettings({ ...singleSettings, ignoreLeadingWhiteSpace: e.target.checked })}
                  />
                  Ignore leading whitespace
                </label>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={singleSettings.strictQuotes}
                    onChange={(e) => setSingleSettings({ ...singleSettings, strictQuotes: e.target.checked })}
                  />
                  Strict quotes
                </label>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={singleSettings.skipDifferingLines}
                    onChange={(e) => setSingleSettings({ ...singleSettings, skipDifferingLines: e.target.checked })}
                  />
                  Skip differing lines
                </label>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => uploadSingleWithSettings()}
                disabled={upload.isPending || updateFileInput.isPending}
                className="text-sm text-white bg-primary px-3 py-1.5 rounded-md hover:opacity-90 disabled:opacity-60"
              >
                {upload.isPending || updateFileInput.isPending ? 'Uploading…' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Lightweight per-row stats component fetching preview (lineCount & headers length)
function DatasetRowStats({ id, fallbackCols }: { id: number; fallbackCols?: number }) {
  // Don't query for optimistic placeholder rows
  if (!id || id <= 0) return <span className="text-xs">—</span>
  const { data, isLoading, isError } = useQuery<{ headers?: string[]; lineCount?: number }>({
    queryKey: ['datasetPreviewCount', id],
    queryFn: async () => {
      const { data } = await api.get(endpoints.fileInputs.preview(id, 5))
      return data as { headers?: string[]; lineCount?: number }
    },
    staleTime: 15_000,
    retry: 2,
    refetchOnWindowFocus: false,
  })
  if (isLoading) return <span className="text-xs text-muted">…</span>
  if (isError) return <span className="text-xs">—</span>
  const cols = data?.headers?.length ?? fallbackCols ?? '—'
  const rows = data?.lineCount ?? '—'
  return <span className="text-xs">{rows} / {cols}</span>
}
