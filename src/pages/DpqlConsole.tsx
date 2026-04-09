import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useDpqlCancelRun, useDpqlExecute, useDpqlResultOverview, useDpqlRunStatus, useDpqlTablePage, DpqlQueryPayload } from '../api/hooks'
import { DpqlOverviewResponse, DpqlTable } from '../api/types'
import { useQuery } from '@tanstack/react-query'
import { useVirtualizer, type VirtualItem } from '@tanstack/react-virtual'
import { useSearchParams } from 'react-router-dom'
import api from '../api/axios'
import { endpoints } from '../api/endpoints'
import { toast } from '../components/Toast'

const SAMPLE_QUERY = `SELECT X, Y FROM CC(*) AS X, CC(*) AS Y WHERE FD(X,Y) AND IND(X,Y)`

const defaultForm = {
  query: SAMPLE_QUERY,
  engineId: '',
  normalizedOnly: false,
}

type EngineParameterSpec = {
  key: string
  label?: string
  type: 'STRING' | 'BOOLEAN'
  required?: boolean
  defaultValue?: string
  placeholder?: string
  helpText?: string
}

export default function DpqlConsole() {
  const [searchParams] = useSearchParams()
  const [form, setForm] = useState(defaultForm)
  const [engineParameters, setEngineParameters] = useState<Record<string, string>>({})
  const [validationError, setValidationError] = useState<string | null>(null)
  const [executionId, setExecutionId] = useState<string | undefined>(undefined)

  // Only show start/finish notifications for runs started in this console session.
  const [notifyExecutionId, setNotifyExecutionId] = useState<string | null>(null)
  const lastNotifiedStatusRef = useRef<string | null>(null)
  const formatShortId = (id: string) => (id && id.length > 8 ? `${id.slice(0, 8)}…` : id)

  const executeMutation = useDpqlExecute()
  const statusQuery = useDpqlRunStatus(executionId)
  const isRunning = statusQuery.data?.status === 'RUNNING' || statusQuery.data?.status === 'QUEUED'
  const overviewQuery = useDpqlResultOverview(executionId, isRunning)
  const cancelMutation = useDpqlCancelRun()

  // Allow opening a past run via /dpql?executionId=...
  useEffect(() => {
    const id = searchParams.get('executionId') || undefined
    if (!id) {
      return
    }

    setExecutionId(id)
    setNotifyExecutionId(null)
    lastNotifiedStatusRef.current = null

    // Best-effort: prefill form fields from stored run metadata (query/engine/mode).
    ;(async () => {
      try {
        const { data } = await api.get(endpoints.dpql.run(id))
        const q = (data?.query as string | undefined) || undefined
        const eid = data?.engineId as number | undefined
        const normalizedOnly = !!data?.normalizedOnly

        setForm((prev) => ({
          ...prev,
          query: q ?? prev.query,
          engineId: eid != null ? String(eid) : prev.engineId,
          normalizedOnly,
        }))
      } catch {
        // ignore; results may still be readable from disk
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleEngineParamChange = (key: string, value: string) => {
    setEngineParameters((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  const buildPayload = (): DpqlQueryPayload => {
    const engineIdNum = form.engineId && String(form.engineId).trim().length ? Number(form.engineId) : undefined
    const extraParams: Record<string, string> = { ...engineParameters }
    return {
      query: form.query.trim(),
      engineId: engineIdNum && !Number.isNaN(engineIdNum) ? engineIdNum : undefined,
      normalizedOnly: !!form.normalizedOnly,
      engineParameters: Object.keys(extraParams).length ? extraParams : undefined,
    }
  }

  const enginesQuery = useQuery<Array<{ id: number; name?: string; fileName: string }>>({
    queryKey: ['engines'],
    queryFn: async () => {
      const { data } = await api.get(endpoints.engines.list)
      return data as Array<{ id: number; name?: string; fileName: string }>
    },
  })

  const engineIdNum = useMemo(() => {
    const n = form.engineId && String(form.engineId).trim().length ? Number(form.engineId) : undefined
    return n && !Number.isNaN(n) ? n : undefined
  }, [form.engineId])

  const engineParamSpecsQuery = useQuery<EngineParameterSpec[]>({
    queryKey: ['engineParamSpecs', engineIdNum ?? 'default'],
    queryFn: async () => {
      const url = engineIdNum ? endpoints.engines.parameters(engineIdNum) : endpoints.engines.parametersDefault
      const { data } = await api.get(url)
      return (data as EngineParameterSpec[]) || []
    },
    enabled: !!engineIdNum,
  })

  const lastEngineKeyRef = useRef<string>('')
  useEffect(() => {
    // Reset engineParameters when switching engine to avoid leaking values between engines.
    const key = String(engineIdNum ?? 'default')
    if (lastEngineKeyRef.current !== key) {
      lastEngineKeyRef.current = key
      setEngineParameters({})
    }
  }, [engineIdNum])

  useEffect(() => {
    // Apply defaults from specs (only if not already set).
    const specs = engineParamSpecsQuery.data
    if (!Array.isArray(specs) || specs.length === 0) return

    for (const s of specs) {
      if (!s?.key) continue

      const k = s.key
      const def = s.defaultValue

      // All parameters are engine-specific: apply defaults into engineParameters.
      if (def != null) {
        setEngineParameters((prev) => {
          if (Object.prototype.hasOwnProperty.call(prev, k)) return prev
          return { ...prev, [k]: def }
        })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineParamSpecsQuery.data])

  const runFullQuery = (e: React.FormEvent) => {
    e.preventDefault()
    setValidationError(null)
    setExecutionId(undefined)
    setNotifyExecutionId(null)
    lastNotifiedStatusRef.current = null

    if (!form.engineId) {
      setValidationError('Please select an engine')
      return
    }

    const specs = engineParamSpecsQuery.data || []
    const missing = getMissingRequired(specs, engineParameters)
    if (missing.length) {
      setValidationError(`Missing required parameters: ${missing.join(', ')}`)
      return
    }

    executeMutation.mutate(buildPayload(), {
      onSuccess: (data: { executionId: string }) => {
        setExecutionId(data.executionId)
        setNotifyExecutionId(data.executionId)
        toast.info(`DPQL run ${formatShortId(data.executionId)} started`, { title: 'DPQL started' })
      },
      onError: (e: any) => {
        const msg = e?.response?.data?.message || e?.response?.data || e?.message || 'DPQL execution failed to start'
        toast.error(String(msg), { title: 'DPQL failed' })
      }
    })
  }

  // Notify once when the run reaches a terminal state.
  useEffect(() => {
    if (!executionId) return
    if (!notifyExecutionId || notifyExecutionId !== executionId) return

    const status = statusQuery.data?.status
    if (!status) return
    if (lastNotifiedStatusRef.current === status) return

    lastNotifiedStatusRef.current = status

    if (status === 'FINISHED') {
      toast.success(`DPQL run ${formatShortId(executionId)} finished`, { title: 'DPQL finished' })
      return
    }
    if (status === 'FAILED') {
      toast.error(`DPQL run ${formatShortId(executionId)} failed`, { title: 'DPQL failed' })
      return
    }
    if (status === 'CANCELED') {
      toast.error(`DPQL run ${formatShortId(executionId)} canceled`, { title: 'DPQL canceled' })
    }
  }, [executionId, notifyExecutionId, statusQuery.data?.status])

  const resetForm = () => {
    setForm(defaultForm)
    setEngineParameters({})
    setValidationError(null)
    setExecutionId(undefined)
    executeMutation.reset()
  }

  const metadataEntries = useMemo(() => {
    const response = overviewQuery.data
    if (!response?.metadata) {
      return []
    }
    return Object.entries(response.metadata)
  }, [overviewQuery.data])

  const statusLabel = useMemo(() => {
    const s = statusQuery.data?.status
    if (!executionId) return null
    return s || 'UNKNOWN'
  }, [executionId, statusQuery.data?.status])

  const canExport = useMemo(() => {
    if (!executionId) return false
    return statusQuery.data?.status === 'FINISHED'
  }, [executionId, statusQuery.data?.status])

  return (
    <div className="space-y-8">
      <section className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl p-6 shadow-xl">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold">DPQL Querry</h1>
        </header>
      </section>

      <section className="bg-white border border-slate-200 rounded-2xl shadow-sm">
        <form onSubmit={runFullQuery} className="p-6 space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Engine</label>
              <select
                value={form.engineId}
                onChange={(e) => handleChange('engineId' as any, e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              >
                <option value="" disabled>
                  Select an engine
                </option>
                {(enginesQuery.data || []).map((e: { id: number; name?: string; fileName: string }) => (
                  <option key={e.id} value={String(e.id)}>
                    {e.name || e.fileName}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500">Upload engines on the Engines page, then select one here per execution.</p>
            </div>
          </div>

          {!form.engineId ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Select an engine to configure the query and engine-specific parameters.
            </div>
          ) : (
            <>
              {executionId && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 flex flex-wrap items-center gap-3">
                  <div>
                    <span className="font-semibold">Run:</span> <span className="font-mono text-xs">{executionId}</span>
                    {statusLabel && <span className="ml-3"><span className="font-semibold">Status:</span> {statusLabel}</span>}
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <button
                      type="button"
                      className="px-3 py-1.5 text-xs border rounded disabled:opacity-50"
                      disabled={!isRunning || cancelMutation.isPending}
                      onClick={() => {
                        if (!executionId) return
                        cancelMutation.mutate(
                          { executionId },
                          {
                            onSuccess: () => {
                              toast.info(`DPQL run ${formatShortId(executionId)} cancel requested`, { title: 'DPQL cancel' })
                            },
                            onError: (e: any) => {
                              const msg = e?.response?.data?.message || e?.response?.data || e?.message || 'Cancel failed'
                              toast.error(String(msg), { title: 'Cancel failed' })
                            },
                          }
                        )
                      }}
                    >
                      {cancelMutation.isPending ? 'Canceling…' : 'Cancel'}
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="dpql-query" className="text-sm font-medium text-slate-700">DPQL Query</label>
                <textarea
                  id="dpql-query"
                  value={form.query}
                  onChange={(e) => handleChange('query', e.target.value)}
                  className="w-full min-h-[180px] rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 font-mono text-sm focus:border-indigo-500 focus:outline-none"
                  spellCheck={false}
                />
                <p className="text-xs text-slate-500">Need inspiration? Use CC() scopes and UCC/FD/IND primitives like in the example above.</p>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium text-slate-700">Result mode</div>
                <ToggleField
                  label="Normalized only (FD/IND/UCC tables)"
                  checked={!!form.normalizedOnly}
                  onChange={(c) => setForm((prev) => ({ ...prev, normalizedOnly: c }))}
                />
                <p className="text-xs text-slate-500">
                  If enabled, the selected engine should emit only normalized FD/IND/UCC tables.
                </p>
              </div>

              {(engineParamSpecsQuery.data || []).length > 0 ? (
                <div className="space-y-4">
                  <div className="text-sm font-medium text-slate-700">Engine parameters</div>
                  <div className="grid gap-4 md:grid-cols-3">
                    {(engineParamSpecsQuery.data || []).map((spec: EngineParameterSpec) => {
                      const key = spec.key
                      const label = spec.label || spec.key
                      const placeholder = spec.placeholder
                      const helpText = spec.helpText

                      if (spec.type === 'BOOLEAN') {
                        const checked = (engineParameters[key] || 'false') === 'true'
                        return (
                          <div key={key}>
                            <ToggleField
                              label={label}
                              checked={checked}
                              onChange={(c) => {
                                handleEngineParamChange(key, c ? 'true' : 'false')
                              }}
                            />
                            {helpText ? <p className="mt-1 text-xs text-slate-500">{helpText}</p> : null}
                          </div>
                        )
                      }

                      // Render as string
                      return (
                        <div key={key}>
                          <TextField
                            label={label}
                            placeholder={placeholder}
                            value={engineParameters[key] || ''}
                            onChange={(val) => handleEngineParamChange(key, val)}
                          />
                          {helpText ? <p className="mt-1 text-xs text-slate-500">{helpText}</p> : null}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  This engine does not expose parameter specifications.
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={executeMutation.isPending}
                >
                  {executeMutation.isPending ? 'Starting...' : 'Run full query'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="inline-flex items-center justify-center rounded-full border border-transparent px-5 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700"
                >
                  Reset form
                </button>
              </div>

              {executeMutation.error && (
                <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {(executeMutation.error as any)?.response?.data || 'DPQL request failed'}
                </div>
              )}

              {validationError && (
                <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 border border-amber-200">
                  {validationError}
                </div>
              )}
            </>
          )}
        </form>
      </section>

      {metadataEntries.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-800">Execution context</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {metadataEntries.map(([key, value]) => (
              <div key={key} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                <dt className="text-xs uppercase tracking-wide text-slate-500">{key}</dt>
                <dd className="text-sm font-medium text-slate-800 break-words">{value as string || '—'}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {executionId && (
        <ResultsGrid executionId={executionId} overview={overviewQuery.data} isLoading={overviewQuery.isLoading} canExport={canExport} />
      )}
    </div>
  )
}

function getMissingRequired(
  specs: EngineParameterSpec[],
  engineParameters: Record<string, string>
): string[] {
  if (!Array.isArray(specs) || specs.length === 0) {
    return []
  }

  const missing: string[] = []
  const isBlank = (v: unknown) => v == null || String(v).trim().length === 0

  for (const spec of specs) {
    if (!spec?.key) continue
    if (!spec.required) continue

    const key = spec.key

    if (spec.type === 'BOOLEAN') {
      // For engine-specific booleans, treat missing if no value has been set.
      // (false is a valid value but will be encoded as 'false')
      if (engineParameters[key] !== 'true' && engineParameters[key] !== 'false') {
        missing.push(spec.label || key)
      }
      continue
    }

    if (isBlank(engineParameters[key])) {
      missing.push(spec.label || key)
    }
  }

  return missing
}

function TextField({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string
  placeholder?: string
  value?: string
  onChange: (value: string) => void
}) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        type="text"
        value={value || ''}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
      />
    </label>
  )
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 text-indigo-600"
      />
      <span className="text-sm font-medium text-slate-700">{label}</span>
    </label>
  )
}

function ResultsGrid({ executionId, overview, isLoading, canExport }: { executionId: string, overview?: DpqlOverviewResponse, isLoading: boolean, canExport: boolean }) {
  if (isLoading) {
    return (
      <section className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
        Loading results...
      </section>
    )
  }

  const tables = overview?.tables || []

  if (!overview || !tables.length) {
    return (
      <section className="rounded-2xl border border-dashed border-emerald-200 p-6 text-center text-sm text-emerald-600">
        The engine reported that no results were produced for this query.
      </section>
    )
  }

  return (
    <section className="space-y-6">
      {tables.map((table: any, index: number) => (
        <PaginatedResultTable
          key={`${table.name || 'table'}-${index}`}
          executionId={executionId}
          tableId={table.tableId}
          initialTableInfo={table}
          fallbackLabel={`Result ${index + 1}`}
          canExport={canExport}
        />
      ))}
    </section>
  )
}

export function PaginatedResultTable({ executionId, tableId, initialTableInfo, fallbackLabel, canExport }: { executionId: string, tableId: number, initialTableInfo: any, fallbackLabel: string, canExport: boolean }) {
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const limit = 100
  const offset = page * limit

  const { data, isLoading, isError } = useDpqlTablePage(executionId, tableId, offset, limit, search)

  const table = data?.table || initialTableInfo
  const rows = data?.rows || []
  const columns = table.columns || []

  const shouldVirtualize = true
  const scrollParentRef = useRef<HTMLDivElement | null>(null)
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollParentRef.current,
    estimateSize: () => 32,
    overscan: 10,
    enabled: shouldVirtualize,
  })

  const exportCsv = async () => {
    setExportError(null)
    setIsExporting(true)
    try {
      const url = endpoints.dpql.tableExportCsv(executionId, tableId, search)
      const response = await api.get(url, {
        responseType: 'blob',
        headers: {
          Accept: 'text/csv',
        },
      })

      const rawName = String(table?.name || fallbackLabel || `table-${tableId}`)
      const safeName = rawName.replace(/[^a-z0-9._-]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 80)
      const filename = `${safeName || `dpql-table-${tableId}`}-${executionId}.csv`

      const blob = response.data as Blob

      const anyWindow = window as any
      const canPickSaveLocation = typeof anyWindow.showSaveFilePicker === 'function'

      if (canPickSaveLocation) {
        try {
          const handle = await anyWindow.showSaveFilePicker({
            suggestedName: filename,
            types: [
              {
                description: 'CSV',
                accept: {
                  'text/csv': ['.csv'],
                },
              },
            ],
          })
          const writable = await handle.createWritable()
          await writable.write(blob)
          await writable.close()
          return
        } catch (err: any) {
          // User canceled the dialog; do not treat as an error.
          if (err?.name === 'AbortError') {
            return
          }
          // Otherwise fall back to classic download behavior.
        }
      }

      const chosenName = window.prompt('Save file as', filename)
      if (!chosenName) {
        return
      }

      const objectUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = chosenName
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000)
    } catch (e: any) {
      setExportError(e?.message ? `Export failed: ${e.message}` : 'Export failed')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <header className="flex flex-wrap items-center gap-3 border-b border-slate-100 pb-3">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">{table.kind || 'TABLE'}</p>
          <h3 className="text-lg font-semibold text-slate-900">{table.name || fallbackLabel}</h3>
        </div>
        <div className="ml-auto flex items-center gap-2">
           {canExport && (
             <button
               type="button"
               onClick={exportCsv}
               disabled={isLoading || isExporting}
               className="px-2 py-1 text-xs border rounded disabled:opacity-50"
               title={search ? 'Export filtered rows as CSV' : 'Export all rows as CSV'}
             >
               {isExporting ? 'Exporting…' : 'Export CSV'}
             </button>
           )}
           <input 
             type="text" 
             placeholder="Search results..." 
             value={search}
             onChange={(e) => { setSearch(e.target.value); setPage(0); }}
             className="px-2 py-1 text-xs border rounded w-32 focus:w-48 transition-all"
           />
           <span className="text-xs text-slate-500">
             {isLoading ? 'Loading...' : `${rows.length} rows shown (Page ${page + 1})`}
           </span>
           <div className="flex gap-1">
             <button 
               onClick={() => setPage(p => Math.max(0, p - 1))}
               disabled={page === 0 || isLoading}
               className="px-2 py-1 text-xs border rounded disabled:opacity-50"
             >
               Prev
             </button>
             <button 
               onClick={() => setPage(p => p + 1)}
               disabled={rows.length < limit || isLoading}
               className="px-2 py-1 text-xs border rounded disabled:opacity-50"
             >
               Next
             </button>
           </div>
        </div>
      </header>
      {exportError && (
        <p className="mt-2 text-xs text-rose-600">{exportError}</p>
      )}
      {columns.length === 0 ? (
        <p className="py-6 text-sm text-slate-500">No columns were returned.</p>
      ) : (
        <div
          ref={scrollParentRef}
          className="mt-4 max-h-[60vh] overflow-auto"
        >
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs uppercase tracking-widest text-slate-500">
                {columns.map((col: string) => (
                  <th
                    key={col}
                    className="sticky top-0 z-10 bg-slate-50 px-3 py-2 font-semibold border-b border-slate-200"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-3 py-4 text-center text-slate-500">
                    {isLoading ? 'Loading rows...' : 'No rows found on this page'}
                  </td>
                </tr>
              ) : (
                (() => {
                  const virtualRows = rowVirtualizer.getVirtualItems()
                  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0
                  const paddingBottom =
                    virtualRows.length > 0
                      ? rowVirtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end
                      : 0

                  return (
                    <>
                      {paddingTop > 0 && (
                        <tr>
                          <td colSpan={columns.length} className="p-0" style={{ height: paddingTop }} />
                        </tr>
                      )}
                      {virtualRows.map((virtualRow: VirtualItem) => {
                        const idx = virtualRow.index
                        const row = rows[idx] as string[]
                        return (
                          <tr key={virtualRow.key} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                            {columns.map((_: any, colIdx: number) => (
                              <td key={`${idx}-${colIdx}`} className="px-3 py-2 text-slate-800">
                                {row?.[colIdx] ?? ''}
                              </td>
                            ))}
                          </tr>
                        )
                      })}
                      {paddingBottom > 0 && (
                        <tr>
                          <td colSpan={columns.length} className="p-0" style={{ height: paddingBottom }} />
                        </tr>
                      )}
                    </>
                  )
                })()
              )}
            </tbody>
          </table>
        </div>
      )}
      {table.metadata && Object.keys(table.metadata).length > 0 && (
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          {Object.entries(table.metadata).map(([key, value]) => (
            <div key={key} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
              <dt className="text-xs uppercase tracking-wide text-slate-500">{key}</dt>
              <dd className="text-sm font-medium text-slate-900 break-words">{value as string}</dd>
            </div>
          ))}
        </dl>
      )}
    </article>
  )
}

function ResultTable({ table, fallbackLabel }: { table: DpqlTable; fallbackLabel: string }) {
  const columns = table.columns || []
  const rows = table.rows || []

  const shouldVirtualize = true
  const scrollParentRef = useRef<HTMLDivElement | null>(null)
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollParentRef.current,
    estimateSize: () => 32,
    overscan: 10,
    enabled: shouldVirtualize,
  })

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <header className="flex flex-wrap items-center gap-3 border-b border-slate-100 pb-3">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">{table.kind || 'TABLE'}</p>
          <h3 className="text-lg font-semibold text-slate-900">{table.name || fallbackLabel}</h3>
        </div>
        <span className="ml-auto text-xs text-slate-500">{rows.length} rows · {columns.length} columns</span>
      </header>
      {columns.length === 0 ? (
        <p className="py-6 text-sm text-slate-500">No columns were returned.</p>
      ) : (
        <div
          ref={scrollParentRef}
          className="mt-4 max-h-[60vh] overflow-auto"
        >
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs uppercase tracking-widest text-slate-500">
                {columns.map((col: string) => (
                  <th
                    key={col}
                    className="sticky top-0 z-10 bg-slate-50 px-3 py-2 font-semibold border-b border-slate-200"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-3 py-4 text-center text-slate-500">No rows</td>
                </tr>
              ) : (
                (() => {
                  const virtualRows = rowVirtualizer.getVirtualItems()
                  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0
                  const paddingBottom =
                    virtualRows.length > 0
                      ? rowVirtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end
                      : 0

                  return (
                    <>
                      {paddingTop > 0 && (
                        <tr>
                          <td colSpan={columns.length} className="p-0" style={{ height: paddingTop }} />
                        </tr>
                      )}
                      {virtualRows.map((virtualRow: VirtualItem) => {
                        const idx = virtualRow.index
                        const row = rows[idx] as string[]
                        return (
                          <tr key={virtualRow.key} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                            {columns.map((_: any, colIdx: number) => (
                              <td key={`${idx}-${colIdx}`} className="px-3 py-2 text-slate-800">
                                {row?.[colIdx] ?? ''}
                              </td>
                            ))}
                          </tr>
                        )
                      })}
                      {paddingBottom > 0 && (
                        <tr>
                          <td colSpan={columns.length} className="p-0" style={{ height: paddingBottom }} />
                        </tr>
                      )}
                    </>
                  )
                })()
              )}
            </tbody>
          </table>
        </div>
      )}
      {table.metadata && Object.keys(table.metadata).length > 0 && (
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          {Object.entries(table.metadata).map(([key, value]) => (
            <div key={key} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
              <dt className="text-xs uppercase tracking-wide text-slate-500">{key}</dt>
              <dd className="text-sm font-medium text-slate-900 break-words">{String(value ?? '')}</dd>
            </div>
          ))}
        </dl>
      )}
    </article>
  )
}
