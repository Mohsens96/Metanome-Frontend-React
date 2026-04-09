import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useVirtualizer, type VirtualItem } from '@tanstack/react-virtual'
import { buildGraph, parseQueryAst } from '../utils/dpqlGraph'
import api from '../api/axios'
import { endpoints } from '../api/endpoints'
import { useDpqlExpand, useDpqlNormalizedTablePage, useDpqlRunStatus, useDpqlTablePage } from '../api/hooks'

type NormalizedTable = {
  tableId: number
  kind?: string
  name?: string
  columns?: string[]
  rowCount?: number
  error?: string
}

type DpqlRun = {
  executionId: string
  createdAt?: number | null
  query?: string | null
  engineId?: number | null
  engineFileName?: string | null
  normalizedOnly?: boolean
  normalizedTables?: NormalizedTable[]
}

type DiskOverview = {
  metadata?: Record<string, unknown>
  tables?: Array<{ tableId: number; kind?: string; name?: string; columns?: string[]; metadata?: Record<string, unknown> }>
}

export default function DpqlRunDetails() {
  const params = useParams()
  const executionId = params.id

  const runQuery = useQuery<DpqlRun | null>({
    queryKey: ['dpqlRun', executionId],
    queryFn: async () => {
      if (!executionId) return null
      const { data } = await api.get(endpoints.dpql.run(executionId))
      return (data as DpqlRun) || null
    },
    enabled: !!executionId,
  })

  const run = runQuery.data
  const statusQuery = useDpqlRunStatus(executionId)
  const canExport = statusQuery.data?.status === 'FINISHED'
  const when = useMemo(() => {
    if (!run?.createdAt) return '—'
    try {
      return new Date(run.createdAt).toLocaleString()
    } catch {
      return String(run.createdAt)
    }
  }, [run?.createdAt])

  const engineLabel = useMemo(() => {
    if (!run) return '—'
    if (run.engineId != null) return `#${run.engineId}`
    return run.engineFileName || '—'
  }, [run])

  const tables = run?.normalizedTables || []

  const diskOverviewQuery = useQuery<DiskOverview | null>({
    queryKey: ['dpqlDiskOverview', executionId],
    queryFn: async () => {
      if (!executionId) return null
      const { data } = await api.get(endpoints.dpql.results(executionId))
      return (data as DiskOverview) || null
    },
    enabled: !!executionId && !!run && !run.normalizedOnly,
    retry: false,
  })

  const deleteRun = async () => {
    if (!executionId) return
    const ok = window.confirm('Remove this DPQL run from history?')
    if (!ok) return
    await api.delete(endpoints.dpql.deleteRun(executionId))
    window.location.href = '/dpql/history'
  }

  return (
    <div className="space-y-6">
      <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-wrap items-start gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">DPQL Run</h1>
            <p className="mt-1 text-sm text-slate-600">Metadata and stored result tables for a past DPQL execution.</p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <Link className="text-sm font-semibold text-slate-700 hover:text-slate-900" to="/dpql/history">
              Back to history
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        {runQuery.isLoading ? (
          <div className="text-sm text-slate-600">Loading run...</div>
        ) : runQuery.isError ? (
          <div className="text-sm text-rose-700">Failed to load run.</div>
        ) : !run ? (
          <div className="text-sm text-slate-600">Run not found.</div>
        ) : (
          <div className="space-y-5">
            <dl className="grid gap-3 sm:grid-cols-2">
              <Meta label="Execution ID" value={run.executionId} />
              <Meta label="Time" value={when} />
              <Meta label="Engine" value={engineLabel} />
              <Meta label="Mode" value={run.normalizedOnly ? 'Normalized' : 'Default'} />
            </dl>

            <div>
              <div className="text-sm font-medium text-slate-700">Query</div>
              <pre className="mt-2 whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 overflow-auto max-h-[40vh]">
                {(run.query || '').trim() || '—'}
              </pre>
            </div>
          </div>
        )}
      </section>

      <section className="space-y-6">
        {run?.normalizedOnly ? (
          tables.length === 0 ? (
            <section className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
              No stored normalized tables for this run.
            </section>
          ) : (
            tables.map((t: NormalizedTable, idx: number) => (
              <VirtualizedStoredTable
                key={`${t.tableId}-${t.kind || 'TABLE'}-${t.name || 'table'}`}
                executionId={run?.executionId || ''}
                where={run?.query || ''}
                table={t}
                fallbackLabel={`Result ${idx + 1}`}
              />
            ))
          )
        ) : (
          <section className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <div className="flex flex-wrap items-center gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Results</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Disk-backed results are available as long as the server still has the stored result file.
                  </p>
                </div>
                <div className="ml-auto text-xs text-slate-500">
                  Status: {statusQuery.data?.status || 'UNKNOWN'}
                </div>
              </div>
            </div>

            {diskOverviewQuery.isLoading ? (
              <section className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                Loading disk results...
              </section>
            ) : diskOverviewQuery.isError ? (
              <section className="rounded-2xl border border-rose-200 bg-rose-50 p-6">
                <div className="text-sm text-rose-800">Results file not found for this run.</div>
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      void deleteRun()
                    }}
                    className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
                  >
                    Remove from history
                  </button>
                </div>
              </section>
            ) : !diskOverviewQuery.data?.tables?.length ? (
              <section className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                No result tables found.
              </section>
            ) : (
              (diskOverviewQuery.data.tables || []).map((t, idx) => (
                <DiskResultTable
                  key={`${t.tableId}-${t.name || 'table'}`}
                  executionId={executionId || ''}
                  tableId={t.tableId}
                  initialTableInfo={t}
                  fallbackLabel={`Result ${idx + 1}`}
                  canExport={!!canExport}
                />
              ))
            )}
          </section>
        )}
      </section>
    </div>
  )
}

function DiskResultTable({
  executionId,
  tableId,
  initialTableInfo,
  fallbackLabel,
  canExport,
}: {
  executionId: string
  tableId: number
  initialTableInfo: any
  fallbackLabel: string
  canExport: boolean
}) {
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [limit, setLimit] = useState(100)
  const offset = page * limit

  const { data, isLoading } = useDpqlTablePage(executionId, tableId, offset, limit, search)
  const table = data?.table || initialTableInfo
  const rows = data?.rows || []
  const columns = table.columns || []

  const scrollParentRef = useRef<HTMLDivElement | null>(null)
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollParentRef.current,
    estimateSize: () => 32,
    overscan: 10,
    enabled: true,
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
          if (err?.name === 'AbortError') return
        }
      }

      const chosenName = window.prompt('Save file as', filename)
      if (!chosenName) return

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
              onClick={() => {
                void exportCsv()
              }}
              disabled={isLoading || isExporting}
              className="px-2 py-1 text-xs border rounded disabled:opacity-50"
              title={search ? 'Export filtered rows as CSV' : 'Export all rows as CSV'}
            >
              {isExporting ? 'Exporting…' : 'Export CSV'}
            </button>
          )}
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-600" htmlFor={`rowsPerPage-disk-${tableId}`}>
              Rows
            </label>
            <select
              id={`rowsPerPage-disk-${tableId}`}
              value={limit}
              onChange={(e) => {
                const next = Math.max(1, parseInt(e.target.value, 10) || 100)
                setLimit(next)
                setPage(0)
              }}
              className="px-2 py-1 text-xs border rounded bg-white"
              title="Rows per page"
            >
              {[100, 200, 500, 1000].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <input
            type="text"
            placeholder="Search results..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(0)
            }}
            className="px-2 py-1 text-xs border rounded w-32 focus:w-48 transition-all"
          />
          <span className="text-xs text-slate-500">
            {isLoading ? 'Loading...' : `${rows.length} rows shown (Page ${page + 1})`}
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0 || isLoading}
              className="px-2 py-1 text-xs border rounded disabled:opacity-50"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              disabled={rows.length < limit || isLoading}
              className="px-2 py-1 text-xs border rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </header>

      {exportError && <p className="mt-2 text-xs text-rose-600">{exportError}</p>}

      {columns.length === 0 ? (
        <p className="py-6 text-sm text-slate-500">No columns were returned.</p>
      ) : (
        <div ref={scrollParentRef} className="mt-4 max-h-[60vh] overflow-auto">
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

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="text-sm font-medium text-slate-900 break-words">{value}</dd>
    </div>
  )
}

function VirtualizedStoredTable({
  executionId,
  where,
  table,
  fallbackLabel,
}: {
  executionId: string
  where: string
  table: NormalizedTable
  fallbackLabel: string
}) {
  const columns = table.columns || []
  const [view, setView] = useState<'table' | 'graph'>('table')
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const [limit, setLimit] = useState(100)

  const pageQuery = useDpqlNormalizedTablePage(executionId, table.tableId, offset, limit, search)
  const page = pageQuery.data
  const pageRows = page?.rows || []
  const pageRowIds = page?.rowIds || []
  const totalRows = page?.totalRows ?? table.rowCount ?? 0

  const [expandMode, setExpandMode] = useState(false)
  const [selectedRowIds, setSelectedRowIds] = useState<Set<number>>(new Set())
  const [selectionAnchorIndex, setSelectionAnchorIndex] = useState<number | null>(null)

  const selectedRowIdsSorted = useMemo(() => {
    return Array.from(selectedRowIds).filter((v) => typeof v === 'number').sort((a, b) => a - b)
  }, [selectedRowIds])

  const [expandOffset, setExpandOffset] = useState(0)
  const [expandLimit, setExpandLimit] = useState(100)
  const [expandSearch, setExpandSearch] = useState('')

  const expandMutation = useDpqlExpand()

  // Trigger expand when selection changes
  const triggerExpand = (rowIds: Set<number>, currentOffset: number, currentLimit: number = expandLimit) => {
    if (!executionId || !(where || '').trim() || !(table.kind || '').trim() || rowIds.size === 0) return
    expandMutation.mutate({
      executionId,
      where,
      anchorKind: table.kind,
      anchorRowIds: Array.from(rowIds),
      offset: currentOffset,
      limit: currentLimit,
    })
  }

  const expandResult = expandMutation.data
  const expandVariables = expandResult?.variables || []
  const expandTuples = expandResult?.tuples || []
  const filteredExpandTuples = useMemo(() => {
    const q = expandSearch.trim().toLowerCase()
    if (!q) return expandTuples
    return expandTuples.filter((t) => {
      const rowValues = Object.values(t?.rowIds || {}).map((v) => (v == null ? '' : String(v)))
      const bindingValues = Object.values(t?.bindings || {}).map((v) => (v == null ? '' : String(v)))
      return [...rowValues, ...bindingValues].some((v) => v.toLowerCase().includes(q))
    })
  }, [expandSearch, expandTuples])
  const expandKinds = useMemo(() => {
    const first = expandTuples[0]
    if (!first || !first.rowIds) return []
    return Object.keys(first.rowIds)
  }, [expandTuples])

  const expandColumnCount = useMemo(() => {
    return expandKinds.length + expandVariables.length
  }, [expandKinds, expandVariables])

  const queryAst = useMemo(() => {
    return parseQueryAst(where || '', expandVariables)
  }, [expandVariables, where])

  const graph = useMemo(() => {
    // Strictly build from current expanded tuples page only.
    return buildGraph(queryAst, filteredExpandTuples, {
      anchorKind: table.kind,
      selectedAnchorRowIds: selectedRowIdsSorted,
      maxNodes: 2000,
      maxEdges: 2000,
    })
  }, [filteredExpandTuples, queryAst, selectedRowIdsSorted, table.kind])

  const [hoveredTupleIndex, setHoveredTupleIndex] = useState<number | null>(null)
  const [pinnedTupleIndices, setPinnedTupleIndices] = useState<Set<number>>(new Set())
  const [tuplePinAnchorIndex, setTuplePinAnchorIndex] = useState<number | null>(null)
  const [graphViewMode, setGraphViewMode] = useState<'union' | 'focus'>('union')
  const [showFD, setShowFD] = useState(true)
  const [showIND, setShowIND] = useState(true)
  const activeTupleIndices = useMemo(() => {
    const pinned = Array.from(pinnedTupleIndices).filter((n) => typeof n === 'number' && n >= 0)
    if (pinned.length > 0) {
      if (hoveredTupleIndex != null && !pinnedTupleIndices.has(hoveredTupleIndex)) {
        return [...pinned, hoveredTupleIndex]
      }
      return pinned
    }
    return hoveredTupleIndex != null ? [hoveredTupleIndex] : []
  }, [hoveredTupleIndex, pinnedTupleIndices])

  useEffect(() => {
    setHoveredTupleIndex(null)
    setPinnedTupleIndices(new Set())
    setTuplePinAnchorIndex(null)
  }, [expandSearch])

  const activeHighlight = useMemo(() => {
    if (activeTupleIndices.length === 0) return null
    const nodeIds = new Set<string>()
    const edgeKeys = new Set<string>()
    for (const idx of activeTupleIndices) {
      const h = graph.tupleHighlights[idx]
      if (!h) continue
      for (const n of h.nodeIds) nodeIds.add(n)
      for (const e of h.edgeKeys) edgeKeys.add(e)
    }
    return { nodeIds, edgeKeys }
  }, [activeTupleIndices, graph.tupleHighlights])

  const edgeAllowedByOpFilter = (edgeType: string) => {
    if (edgeType.startsWith('FD_')) return showFD
    if (edgeType.startsWith('IND_')) return showIND
    return true
  }

  // In focus mode, changes in hovered/pinned tuples can change the set of visible nodes.
  // If we let the SVG height auto-grow/shrink, it can push the expanded tuples table
  // under the mouse cursor and cause an enter/reflow oscillation. Keep a stable
  // viewport height and scroll inside the graph instead.
  const focusGraphViewportHeight = useMemo(() => {
    const marginTop = 32
    const rowGap = 34

    const ccCount = graph.nodes.filter((n) => n.type === 'CC').length
    const predCount = graph.nodes.filter((n) => {
      if (n.type !== 'PREDICATE') return false
      if (n.op === 'UCC') return false
      if (n.op === 'FD' && !showFD) return false
      if (n.op === 'IND' && !showIND) return false
      return true
    }).length

    const maxRows = Math.max(1, ccCount, predCount)
    const unionHeight = Math.max(240, marginTop + 30 + maxRows * rowGap + 24)

    // Cap to keep the page usable; the graph itself remains scrollable.
    return Math.min(unionHeight, 520)
  }, [graph.nodes, showFD, showIND])

  const graphLayout = useMemo(() => {
    // Two-layer layout: CC nodes on the left, dependency nodes on the right.
    const activeNodeFilter = (n: { id: string }) => {
      if (graphViewMode !== 'focus') return true
      if (!activeHighlight) return false
      return activeHighlight.nodeIds.has(n.id)
    }

    const cc = graph.nodes
      .filter((n) => n.type === 'CC')
      .filter(activeNodeFilter)
      .sort((a, b) => a.label.localeCompare(b.label))
    const opOrder: Record<string, number> = { FD: 1, IND: 2, UCC: 3, MIN: 4, MAX: 5 }
    const pred = graph.nodes
      .filter((n) => {
        if (n.type !== 'PREDICATE') return false
        if (n.op === 'UCC') return false
        if (!activeNodeFilter(n)) return false
        if (n.op === 'FD' && !showFD) return false
        if (n.op === 'IND' && !showIND) return false
        return true
      })
      .sort((a, b) => {
        const ao = opOrder[a.op || ''] ?? 99
        const bo = opOrder[b.op || ''] ?? 99
        if (ao !== bo) return ao - bo
        return a.label.localeCompare(b.label)
      })

    const marginX = 24
    const marginTop = 32
    const colGap = 360
    const rowGap = 34

    const leftX = marginX + 40
    const rightX = marginX + colGap + 40

    const maxRows = Math.max(1, cc.length, pred.length)
    const width = Math.max(720, rightX + 220)
    const height = Math.max(240, marginTop + 30 + maxRows * rowGap + 24)

    const pos = new Map<string, { x: number; y: number }>()

    cc.forEach((n, i) => {
      pos.set(n.id, { x: leftX, y: marginTop + i * rowGap + 30 })
    })
    pred.forEach((n, i) => {
      pos.set(n.id, { x: rightX, y: marginTop + i * rowGap + 30 })
    })

    return {
      width,
      height,
      cc,
      pred,
      pos,
      truncated: graph.truncated,
      // Hide UCC edges (rendered as CC badges instead)
      edges: graph.edges
        .filter((e) => e.type !== 'UCC_IN' && edgeAllowedByOpFilter(e.type))
        .filter((e) => {
          if (graphViewMode !== 'focus') return true
          if (!activeHighlight) return false
          const key = `${e.from}|${e.to}|${e.type}`
          return activeHighlight.edgeKeys.has(key)
        }),
      uccByCcId: (() => {
        if (graphViewMode !== 'focus' || !activeHighlight) return graph.uccByCcId
        const out: Record<string, string[]> = {}
        for (const [ccId, uccIds] of Object.entries(graph.uccByCcId || {})) {
          if (!activeHighlight.nodeIds.has(ccId)) continue
          const keep = (uccIds || []).filter((pid) => activeHighlight.nodeIds.has(pid))
          if (keep.length > 0) out[ccId] = keep
        }
        return out
      })(),
      uccPredById: new Map(graph.nodes.filter((n) => n.type === 'PREDICATE' && n.op === 'UCC').map((n) => [n.id, n])),
    }
  }, [activeHighlight, edgeAllowedByOpFilter, graph.edges, graph.nodes, graph.truncated, graphViewMode, showFD, showIND])

  const edgeStrokeClass = (edgeType: string) => {
    if (edgeType.startsWith('FD_')) return 'stroke-blue-400'
    if (edgeType.startsWith('IND_')) return 'stroke-orange-400'
    if (edgeType.startsWith('UCC_')) return 'stroke-emerald-400'
    if (edgeType.startsWith('MIN_')) return 'stroke-violet-400'
    if (edgeType.startsWith('MAX_')) return 'stroke-violet-400'
    return 'stroke-slate-300'
  }

  const predicateFillClass = (op?: string, unmatched?: boolean) => {
    if (unmatched) return 'fill-slate-200'
    if (op === 'FD') return 'fill-blue-600'
    if (op === 'IND') return 'fill-orange-600'
    if (op === 'UCC') return 'fill-emerald-600'
    if (op === 'MIN' || op === 'MAX') return 'fill-violet-600'
    return 'fill-slate-900'
  }

  const scrollParentRef = useRef<HTMLDivElement | null>(null)
  const rowVirtualizer = useVirtualizer({
    count: pageRows.length,
    getScrollElement: () => scrollParentRef.current,
    estimateSize: () => 32,
    overscan: 10,
    enabled: true,
  })

  const expandScrollParentRef = useRef<HTMLDivElement | null>(null)
  const expandRowVirtualizer = useVirtualizer({
    count: filteredExpandTuples.length,
    getScrollElement: () => expandScrollParentRef.current,
    estimateSize: () => 32,
    overscan: 10,
    enabled: true,
  })

  const tableElement = (
    <div ref={scrollParentRef} className="mt-4 max-h-[60vh] overflow-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-slate-50 text-left text-xs uppercase tracking-widest text-slate-500">
            {columns.map((col) => (
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
          {pageRows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-4 text-center text-slate-500">
                {pageQuery.isLoading ? 'Loading…' : (search.trim().length ? 'No rows match your search' : 'No rows')}
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
                    const row = pageRows[idx] as string[]
                    const rowId = pageRowIds[idx] ?? (offset + idx)
                    const isSelected = expandMode && selectedRowIds.has(rowId)
                    return (
                      <tr
                        key={virtualRow.key}
                        className={
                          isSelected
                            ? 'bg-slate-900 text-white'
                            : (idx % 2 === 0 ? 'bg-white' : 'bg-slate-50')
                        }
                        onClick={(e) => {
                          if (!expandMode) return

                          const isRange = (e.ctrlKey || e.metaKey) && e.shiftKey
                          const newSelection = new Set(selectedRowIds)

                          if (isRange && selectionAnchorIndex != null) {
                            const start = Math.min(selectionAnchorIndex, idx)
                            const end = Math.max(selectionAnchorIndex, idx)
                            const shouldSelect = !newSelection.has(rowId)
                            for (let j = start; j <= end; j++) {
                              const id = pageRowIds[j] ?? (offset + j)
                              if (shouldSelect) newSelection.add(id)
                              else newSelection.delete(id)
                            }
                          } else {
                            if (newSelection.has(rowId)) newSelection.delete(rowId)
                            else newSelection.add(rowId)
                          }

                          setSelectedRowIds(newSelection)
                          setSelectionAnchorIndex(idx)
                          setExpandOffset(0)
                          setHoveredTupleIndex(null)
                          setPinnedTupleIndices(new Set())
                          setTuplePinAnchorIndex(null)
                          if (newSelection.size > 0) {
                            triggerExpand(newSelection, 0)
                          }
                        }}
                        title={
                          expandMode
                            ? (selectedRowIds.has(rowId)
                                ? 'Click to deselect'
                                : 'Click to select')
                            : undefined
                        }
                        style={expandMode ? { cursor: 'pointer' } : undefined}
                      >
                        {columns.map((_, colIdx) => (
                          <td key={`${idx}-${colIdx}`} className={isSelected ? 'px-3 py-2' : 'px-3 py-2 text-slate-800'}>
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
  )

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <header className="flex flex-wrap items-center gap-3 border-b border-slate-100 pb-3">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">{table.kind || 'TABLE'}</p>
          <h3 className="text-lg font-semibold text-slate-900">{table.name || fallbackLabel}</h3>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setView('table')}
              className={view === 'table' ? 'px-2 py-1 text-xs border rounded bg-slate-900 text-white' : 'px-2 py-1 text-xs border rounded'}
              title="Show results as table"
            >
              Table
            </button>
            <button
              type="button"
              onClick={() => setView('graph')}
              className={view === 'graph' ? 'px-2 py-1 text-xs border rounded bg-slate-900 text-white' : 'px-2 py-1 text-xs border rounded'}
              title="Show expansion as graph"
            >
              Graph
            </button>
          </div>
          <input
            type="text"
            placeholder="Search results..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setOffset(0)
            }}
            className="px-2 py-1 text-xs border rounded w-32 focus:w-48 transition-all"
          />
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-600" htmlFor={`rowsPerPage-${table.tableId}`}>
              Rows
            </label>
            <select
              id={`rowsPerPage-${table.tableId}`}
              value={limit}
              onChange={(e) => {
                const next = Math.max(1, parseInt(e.target.value, 10) || 100)
                setLimit(next)
                setOffset(0)
                setSelectedRowIds(new Set())
                setSelectionAnchorIndex(null)
                setExpandOffset(0)
              }}
              className="px-2 py-1 text-xs border rounded bg-white"
              title="Rows per page"
            >
              {[100, 200, 500, 1000].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => setOffset((v) => Math.max(0, v - limit))}
            disabled={offset === 0 || pageQuery.isLoading}
            className="px-2 py-1 text-xs border rounded disabled:opacity-50"
          >
            Prev
          </button>
          <button
            type="button"
            onClick={() => setOffset((v) => v + limit)}
            disabled={offset + pageRows.length >= totalRows || pageQuery.isLoading}
            className="px-2 py-1 text-xs border rounded disabled:opacity-50"
          >
            Next
          </button>
          <button
            type="button"
            onClick={() => {
              setExpandMode((v) => {
                const next = !v
                if (!next) {
                  setSelectedRowIds(new Set())
                  setExpandOffset(0)
                }
                return next
              })
            }}
            className={
              expandMode
                ? 'px-2 py-1 text-xs border rounded bg-slate-900 text-white'
                : 'px-2 py-1 text-xs border rounded'
            }
            disabled={!executionId || !(where || '').trim() || !(table.kind || '').trim()}
            title={
              !executionId
                ? 'Missing execution id'
                : !(where || '').trim()
                  ? 'Missing stored query for this run'
                  : !(table.kind || '').trim()
                    ? 'Missing table kind'
                    : 'Toggle expand mode'
            }
          >
            Expand mode
          </button>
          <span className="text-xs text-slate-500">
            {pageQuery.isLoading ? 'Loading…' : `${pageRows.length} rows shown`} · {totalRows} total · {columns.length} columns
            {expandMode && selectedRowIds.size > 0 && ` · ${selectedRowIds.size} selected`}
          </span>
        </div>
      </header>

      {expandMode && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-700">
          {view === 'table' ? (
            <>
              Click rows to toggle selection. <strong>Ctrl+Shift+Click</strong> selects a range on this page. Selected rows will be expanded using fast SQL joins.
            </>
          ) : (
            <>
              Click rows to toggle selection. <strong>Ctrl+Shift+Click</strong> selects a range on this page. Selected rows will be expanded and visualized as a graph.
            </>
          )}
          {selectedRowIds.size > 0 && (
            <button
              type="button"
              onClick={() => {
                setSelectedRowIds(new Set())
                setSelectionAnchorIndex(null)
                setExpandOffset(0)
              }}
              className="ml-3 text-rose-600 hover:text-rose-700 underline"
            >
              Clear selection
            </button>
          )}
        </div>
      )}

      {table.error ? (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {table.error}
        </div>
      ) : pageQuery.isError ? (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          Failed to load table page.
        </div>
      ) : columns.length === 0 ? (
        <p className="py-6 text-sm text-slate-500">No columns were returned.</p>
      ) : (
        <>
          {tableElement}
          {view === 'graph' && expandMode && selectedRowIds.size > 0 && (
            <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
              <header className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3">
                <div className="text-sm font-semibold text-slate-900">Graph</div>
                <div className="ml-auto text-xs text-slate-500">
                  {expandMutation.isPending
                    ? 'Loading...'
                    : `Showing graph for ${selectedRowIds.size} selected row${selectedRowIds.size > 1 ? 's' : ''}`}
                </div>
              </header>

              {expandMutation.isError ? (
                <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                  Failed to expand pattern.
                </div>
              ) : expandMutation.isPending ? (
                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  Loading join edges…
                </div>
              ) : !graphLayout || graph.nodes.length === 0 ? (
                <div className="mt-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                  No graph to display for this selection.
                </div>
              ) : (
                <div className="mt-3">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setGraphViewMode('union')}
                        className={graphViewMode === 'union' ? 'px-2 py-1 text-xs border rounded bg-slate-900 text-white' : 'px-2 py-1 text-xs border rounded'}
                        title="Show union of all tuples on this expanded page"
                      >
                        Union
                      </button>
                      <button
                        type="button"
                        onClick={() => setGraphViewMode('focus')}
                        className={graphViewMode === 'focus' ? 'px-2 py-1 text-xs border rounded bg-slate-900 text-white' : 'px-2 py-1 text-xs border rounded'}
                        title="Show only the currently hovered/pinned tuple path"
                      >
                        Focus
                      </button>
                    </div>
                    <div className="ml-2 flex items-center gap-2 text-xs text-slate-600">
                      <label className="inline-flex items-center gap-1">
                        <input type="checkbox" checked={showFD} onChange={(e) => setShowFD(e.target.checked)} />
                        FD
                      </label>
                      <label className="inline-flex items-center gap-1">
                        <input type="checkbox" checked={showIND} onChange={(e) => setShowIND(e.target.checked)} />
                        IND
                      </label>
                    </div>
                    <div className="ml-auto text-xs text-slate-500">
                      {pinnedTupleIndices.size > 0
                        ? `Pinned: ${pinnedTupleIndices.size} tuple${pinnedTupleIndices.size > 1 ? 's' : ''}`
                        : (hoveredTupleIndex != null ? `Hovering tuple #${hoveredTupleIndex + 1}` : 'No tuple focused')}
                      {hoveredTupleIndex != null && pinnedTupleIndices.size === 0 && (
                        <button
                          type="button"
                          className="ml-2 underline text-slate-600 hover:text-slate-800"
                          onClick={() => setHoveredTupleIndex(null)}
                          title="Clear hover focus"
                        >
                          Clear hover
                        </button>
                      )}
                      {pinnedTupleIndices.size > 0 && (
                        <button
                          type="button"
                          className="ml-2 underline text-slate-600 hover:text-slate-800"
                          onClick={() => setPinnedTupleIndices(new Set())}
                          title="Clear pins"
                        >
                          Clear pins
                        </button>
                      )}
                    </div>
                  </div>

                  {graphViewMode === 'focus' && activeTupleIndices.length === 0 && (
                    <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                      Hover an expanded tuple row (or click to pin) to render only its path.
                    </div>
                  )}

                  <div
                    className="overflow-auto"
                    style={graphViewMode === 'focus' ? { height: focusGraphViewportHeight } : undefined}
                  >
                    <svg
                      width="100%"
                      height={graphLayout.height}
                      viewBox={`0 0 ${graphLayout.width} ${graphLayout.height}`}
                      className="text-slate-700"
                      role="img"
                      aria-label="DPQL expansion graph"
                    >
                    <defs>
                      <marker
                        id="arrow"
                        viewBox="0 0 10 10"
                        refX="10"
                        refY="5"
                        markerWidth="6"
                        markerHeight="6"
                        orient="auto-start-reverse"
                      >
                        <path d="M 0 0 L 10 5 L 0 10 z" className="fill-slate-400" />
                      </marker>
                    </defs>

                    {/* Headers */}
                    <text x={64} y={20} className="fill-slate-500" fontSize={11} style={{ letterSpacing: '0.12em' }}>CC</text>
                    <text x={64 + 360} y={20} className="fill-slate-500" fontSize={11} style={{ letterSpacing: '0.12em' }}>DEPENDENCY</text>

                    {/* Edges (strictly CC → PREDICATE → CC) */}
                    {graphLayout.edges.map((e, idx) => {
                      const from = graphLayout.pos.get(e.from)
                      const to = graphLayout.pos.get(e.to)
                      if (!from || !to) return null

                      const edgeKey = `${e.from}|${e.to}|${e.type}`
                      const inActivePath = activeHighlight ? activeHighlight.edgeKeys.has(edgeKey) : false

                      // Shorten the segment so arrowheads don't sit under node shapes.
                      const dx = to.x - from.x
                      const dy = to.y - from.y
                      const len = Math.hypot(dx, dy) || 1
                      const ux = dx / len
                      const uy = dy / len

                      // CC circles have r=12; dependency rects are 28x20.
                      const padFrom = 14
                      const padTo = 18
                      const sx = from.x + ux * padFrom
                      const sy = from.y + uy * padFrom
                      const ex = to.x - ux * padTo
                      const ey = to.y - uy * padTo

                      const d = `M ${sx} ${sy} L ${ex} ${ey}`

                      const dim = graphViewMode === 'union' && activeHighlight ? !inActivePath : false

                      return (
                        <path
                          key={idx}
                          d={d}
                          className={`${edgeStrokeClass(e.type)} ${dim ? 'opacity-15' : 'opacity-100'}`}
                          strokeWidth={dim ? 1 : 1.5}
                          fill="none"
                          markerEnd="url(#arrow)"
                        />
                      )
                    })}

                    {/* CC nodes */}
                    {graphLayout.cc.map((n) => {
                      const p = graphLayout.pos.get(n.id)
                      if (!p) return null

                      const inActivePath = activeHighlight ? activeHighlight.nodeIds.has(n.id) : false
                      const dim = graphViewMode === 'union' && activeHighlight ? !inActivePath : false

                      const uccPredIds = graphLayout.uccByCcId?.[n.id] || []
                      const uccCount = uccPredIds.length
                      const uccTitle = uccCount
                        ? `UCC: ${uccPredIds
                            .map((pid) => {
                              const pn = graphLayout.uccPredById.get(pid)
                              return pn?.label || 'UCC'
                            })
                            .join(', ')}`
                        : ''

                      return (
                        <g key={n.id}>
                          <circle
                            cx={p.x}
                            cy={p.y}
                            r={12}
                            className={`fill-white ${dim ? 'opacity-35' : 'opacity-100'}`}
                            strokeWidth={1}
                            stroke="currentColor"
                          />
                          <text x={p.x + 18} y={p.y + 4} className={`fill-slate-800 ${dim ? 'opacity-35' : 'opacity-100'}`} fontSize={11}>
                            {n.label}
                          </text>
                          <title>{n.title || n.label}</title>

                          {/* UCC badge (collapsed unary predicate) */}
                          {uccCount > 0 && (
                            <g>
                              <rect
                                x={p.x + 6}
                                y={p.y - 22}
                                width={uccCount > 1 ? 44 : 34}
                                height={16}
                                rx={8}
                                className={dim ? 'fill-emerald-200 opacity-60' : 'fill-emerald-200'}
                              />
                              <text x={p.x + 12} y={p.y - 10} className="fill-emerald-900" fontSize={10}>
                                {uccCount > 1 ? `UCC×${uccCount}` : 'UCC'}
                              </text>
                              <title>{uccTitle}</title>
                            </g>
                          )}
                        </g>
                      )
                    })}

                    {/* Dependency nodes */}
                    {graphLayout.pred.map((n) => {
                      const p = graphLayout.pos.get(n.id)
                      if (!p) return null
                      const isUnmatched = !!n.unmatched

                      const inActivePath = activeHighlight ? activeHighlight.nodeIds.has(n.id) : false
                      const dim = graphViewMode === 'union' && activeHighlight ? !inActivePath : false

                      return (
                        <g key={n.id}>
                          <rect
                            x={p.x - 14}
                            y={p.y - 10}
                            width={28}
                            height={20}
                            rx={6}
                            className={`${predicateFillClass(n.op, isUnmatched)} ${dim ? 'opacity-20' : 'opacity-100'}`}
                          />
                          <text x={p.x + 22} y={p.y + 4} className={isUnmatched ? 'fill-slate-500' : 'fill-slate-800'} fontSize={11}>
                            {n.label}
                          </text>
                          <title>{n.title || n.label}</title>
                        </g>
                      )
                    })}
                    </svg>
                  </div>

                  {/* Legend */}
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                    <span className="inline-flex items-center gap-2">
                      <span className="inline-block h-3 w-3 rounded-full border border-slate-600 bg-white" />
                      CC (column combination)
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <span className="inline-block h-3 w-3 rounded bg-blue-600" />
                      FD
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <span className="inline-block h-3 w-3 rounded bg-orange-600" />
                      IND
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <span className="inline-block h-3 w-3 rounded bg-emerald-200 border border-emerald-500" />
                      UCC badge
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <span className="inline-block h-3 w-3 rounded bg-slate-200" />
                      Selected but unmatched
                    </span>
                    <span className="ml-auto text-slate-500">
                      Hover highlights · click pins
                    </span>
                  </div>

                  <div className="mt-2 text-xs text-slate-500">
                    Graph shows the current expansion page (offset {expandOffset}, limit {expandLimit}).
                    {graphLayout.truncated && (
                      <span className="ml-2">(truncated to keep it interactive)</span>
                    )}
                  </div>
                </div>
              )}
            </section>
          )}
        </>
      )}

      {expandMode && selectedRowIds.size > 0 && (
        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
          <header className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3">
            <div className="text-sm font-semibold text-slate-900">
              Expanded tuples
              <span className="ml-2 text-xs font-normal text-slate-500">
                (from {selectedRowIds.size} selected row{selectedRowIds.size > 1 ? 's' : ''})
              </span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-600" htmlFor={`rowsPerPage-expand-${table.tableId}`}>
                  Rows
                </label>
                <select
                  id={`rowsPerPage-expand-${table.tableId}`}
                  value={expandLimit}
                  onChange={(e) => {
                    const next = Math.max(1, parseInt(e.target.value, 10) || 100)
                    setExpandLimit(next)
                    setExpandOffset(0)
                    setHoveredTupleIndex(null)
                    setPinnedTupleIndices(new Set())
                    setTuplePinAnchorIndex(null)
                    triggerExpand(selectedRowIds, 0, next)
                  }}
                  className="px-2 py-1 text-xs border rounded bg-white"
                  title="Rows per page"
                >
                  {[100, 200, 500, 1000].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
              <input
                type="text"
                value={expandSearch}
                onChange={(e) => setExpandSearch(e.target.value)}
                placeholder="Search tuples"
                className="px-2 py-1 text-xs border rounded bg-white"
                aria-label="Search expanded tuples"
              />
              <span className="text-xs text-slate-500">
                {expandMutation.isPending
                  ? 'Loading...'
                  : `${filteredExpandTuples.length} tuples shown${expandSearch.trim() ? ` of ${expandTuples.length}` : ''} (Page ${Math.floor(expandOffset / expandLimit) + 1})`}
              </span>
              <button
                type="button"
                onClick={() => {
                  const next = Math.max(0, expandOffset - expandLimit)
                  setExpandOffset(next)
                  setHoveredTupleIndex(null)
                  setPinnedTupleIndices(new Set())
                  setTuplePinAnchorIndex(null)
                  triggerExpand(selectedRowIds, next)
                }}
                disabled={expandOffset === 0 || expandMutation.isPending}
                className="px-2 py-1 text-xs border rounded disabled:opacity-50"
              >
                Prev
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = expandOffset + expandLimit
                  setExpandOffset(next)
                  setHoveredTupleIndex(null)
                  setPinnedTupleIndices(new Set())
                  setTuplePinAnchorIndex(null)
                  triggerExpand(selectedRowIds, next)
                }}
                disabled={expandTuples.length < expandLimit || expandMutation.isPending}
                className="px-2 py-1 text-xs border rounded disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </header>

          {expandMutation.isError ? (
            <div className="mt-3 text-sm text-rose-700">
              Failed to expand pattern.
            </div>
          ) : expandVariables.length === 0 ? (
            <div className="mt-3 text-sm text-slate-500">
              {expandMutation.isPending ? 'Loading tuples…' : 'No tuples returned.'}
            </div>
          ) : (
            <div ref={expandScrollParentRef} className="mt-3 max-h-[60vh] overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs uppercase tracking-widest text-slate-500">
                    {expandKinds.map((k) => (
                      <th
                        key={k}
                        className="sticky top-0 z-10 bg-slate-50 px-3 py-2 font-semibold border-b border-slate-200"
                      >
                        {k}
                      </th>
                    ))}
                    {expandVariables.map((v) => (
                      <th
                        key={v}
                        className="sticky top-0 z-10 bg-slate-50 px-3 py-2 font-semibold border-b border-slate-200"
                      >
                        {v}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredExpandTuples.length === 0 ? (
                    <tr>
                      <td colSpan={expandColumnCount} className="px-3 py-4 text-center text-slate-500">
                        No tuples
                      </td>
                    </tr>
                  ) : (
                    (() => {
                      const virtualRows = expandRowVirtualizer.getVirtualItems()
                      const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0
                      const paddingBottom =
                        virtualRows.length > 0
                          ? expandRowVirtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end
                          : 0

                      return (
                        <>
                          {paddingTop > 0 && (
                            <tr>
                              <td colSpan={expandColumnCount} className="p-0" style={{ height: paddingTop }} />
                            </tr>
                          )}
                          {virtualRows.map((virtualRow: VirtualItem) => {
                            const i = virtualRow.index
                            const t = filteredExpandTuples[i]

                            return (
                              <tr
                                key={virtualRow.key}
                                className={
                                  pinnedTupleIndices.has(i)
                                    ? 'bg-slate-900 text-white'
                                    : (i % 2 === 0 ? 'bg-white' : 'bg-slate-50')
                                }
                                onMouseEnter={
                                  view === 'graph'
                                    ? () => {
                                        // Sticky hover: do not auto-clear to avoid layout-driven enter/leave loops.
                                        setHoveredTupleIndex((cur) => (cur === i ? cur : i))
                                      }
                                    : undefined
                                }
                                title={
                                  view === 'graph'
                                    ? 'Hover to highlight · Click to pin/unpin · Ctrl+Shift+Click to pin a range'
                                    : undefined
                                }
                                onClick={
                                  view === 'graph'
                                    ? (e) => {
                                        const isRange = (e.ctrlKey || e.metaKey) && e.shiftKey
                                        const next = new Set(pinnedTupleIndices)

                                        if (isRange && tuplePinAnchorIndex != null) {
                                          const start = Math.min(tuplePinAnchorIndex, i)
                                          const end = Math.max(tuplePinAnchorIndex, i)
                                          const shouldPin = !next.has(i)
                                          for (let j = start; j <= end; j++) {
                                            if (shouldPin) next.add(j)
                                            else next.delete(j)
                                          }
                                        } else {
                                          if (next.has(i)) next.delete(i)
                                          else next.add(i)
                                        }

                                        setPinnedTupleIndices(next)
                                        setTuplePinAnchorIndex(i)
                                      }
                                    : undefined
                                }
                                style={view === 'graph' ? { cursor: 'pointer' } : undefined}
                              >
                                {expandKinds.map((k) => (
                                  <td
                                    key={k}
                                    className={
                                      pinnedTupleIndices.has(i)
                                        ? 'px-3 py-2 text-white'
                                        : 'px-3 py-2 text-slate-800'
                                    }
                                  >
                                    {t?.rowIds?.[k] ?? ''}
                                  </td>
                                ))}
                                {expandVariables.map((v) => (
                                  <td
                                    key={v}
                                    className={
                                      pinnedTupleIndices.has(i)
                                        ? 'px-3 py-2 text-white'
                                        : 'px-3 py-2 text-slate-800'
                                    }
                                  >
                                    {t?.bindings?.[v] ?? ''}
                                  </td>
                                ))}
                              </tr>
                            )
                          })}
                          {paddingBottom > 0 && (
                            <tr>
                              <td colSpan={expandColumnCount} className="p-0" style={{ height: paddingBottom }} />
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
        </section>
      )}
    </article>
  )
}
