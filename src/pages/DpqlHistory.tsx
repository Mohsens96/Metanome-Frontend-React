import React, { useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useVirtualizer } from '@tanstack/react-virtual'
import api from '../api/axios'
import { endpoints } from '../api/endpoints'

type DpqlRunListItem = {
  executionId: string
  createdAt?: number | null
  query?: string
  engineId?: number | null
  engineFileName?: string | null
  normalizedOnly?: boolean
  hasNormalizedTables?: boolean
}

export default function DpqlHistory() {
  const [search, setSearch] = useState('')
  const scrollParentRef = useRef<HTMLDivElement | null>(null)
  const queryClient = useQueryClient()

  const runsQuery = useQuery<DpqlRunListItem[]>({
    queryKey: ['dpqlRuns'],
    queryFn: async () => {
      const { data } = await api.get(endpoints.dpql.runs)
      return (data as DpqlRunListItem[]) || []
    },
  })

  const deleteRunMutation = useMutation({
    mutationFn: async (executionId: string) => {
      await api.delete(endpoints.dpql.deleteRun(executionId))
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['dpqlRuns'] })
    },
  })

  const filteredRuns = useMemo(() => {
    const runs = runsQuery.data || []
    const q = search.trim().toLowerCase()
    if (!q) return runs

    return runs.filter((r) => {
      const when = r.createdAt ? new Date(r.createdAt).toLocaleString() : ''
      const engine = r.engineId != null ? `#${r.engineId}` : (r.engineFileName || '')
      const mode = r.normalizedOnly ? 'normalized' : 'default'
      const query = (r.query || '').trim()
      const haystack = `${r.executionId} ${when} ${engine} ${mode} ${query}`.toLowerCase()
      return haystack.includes(q)
    })
  }, [runsQuery.data, search])

  const rowVirtualizer = useVirtualizer({
    count: filteredRuns.length,
    getScrollElement: () => scrollParentRef.current,
    estimateSize: () => 44,
    overscan: 12,
  })

  return (
    <div className="space-y-6">
      <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">DPQL History</h1>
        <p className="mt-1 text-sm text-slate-600">Browse and reopen past DPQL executions.</p>
      </section>

      <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        {runsQuery.isLoading ? (
          <div className="text-sm text-slate-600">Loading runs...</div>
        ) : runsQuery.isError ? (
          <div className="text-sm text-rose-700">Failed to load DPQL history.</div>
        ) : (runsQuery.data || []).length === 0 ? (
          <div className="text-sm text-slate-600">No DPQL runs stored yet.</div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex-1">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by id, query, engine, mode..."
                  className="w-full max-w-xl rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
              </div>
              <div className="text-xs text-slate-500 whitespace-nowrap">
                Showing {filteredRuns.length} / {(runsQuery.data || []).length}
              </div>
            </div>

            {filteredRuns.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                No runs match your search.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-[920px]">
                  <div className="grid grid-cols-[180px_140px_120px_1fr_84px] bg-slate-50 text-left text-xs uppercase tracking-widest text-slate-500 rounded-xl border border-slate-200">
                    <div className="px-3 py-2 font-semibold">Time</div>
                    <div className="px-3 py-2 font-semibold">Engine</div>
                    <div className="px-3 py-2 font-semibold">Mode</div>
                    <div className="px-3 py-2 font-semibold">Query</div>
                    <div className="px-3 py-2 font-semibold text-right">Actions</div>
                  </div>

                  <div ref={scrollParentRef} className="mt-2 max-h-[70vh] overflow-auto rounded-xl border border-slate-200">
                    <div
                      style={{
                        height: rowVirtualizer.getTotalSize(),
                        width: '100%',
                        position: 'relative',
                      }}
                    >
                      {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                        const r = filteredRuns[virtualRow.index]
                        const when = r.createdAt ? new Date(r.createdAt).toLocaleString() : '—'
                        const engine = r.engineId != null ? `#${r.engineId}` : (r.engineFileName || '—')
                        const mode = r.normalizedOnly ? 'Normalized' : 'Default'
                        const query = (r.query || '').trim()
                        const shortQuery = query.length > 180 ? query.slice(0, 180) + '…' : query

                        return (
                          <div
                            key={r.executionId}
                            className={
                              'grid grid-cols-[180px_140px_120px_1fr_84px] items-center border-t border-slate-100 text-sm ' +
                              (virtualRow.index % 2 === 0 ? 'bg-white' : 'bg-slate-50')
                            }
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '100%',
                              height: virtualRow.size,
                              transform: `translateY(${virtualRow.start}px)`,
                            }}
                          >
                            <div className="px-3 py-2 text-slate-700 whitespace-nowrap">{when}</div>
                            <div className="px-3 py-2 text-slate-700 whitespace-nowrap">{engine}</div>
                            <div className="px-3 py-2 text-slate-700 whitespace-nowrap">{mode}</div>
                            <div className="px-3 py-2 text-slate-700">{shortQuery || '—'}</div>
                            <div className="px-3 py-2 text-right whitespace-nowrap">
                              <Link
                                className="text-indigo-600 hover:text-indigo-500 text-sm font-semibold"
                                to={`/dpql/history/${encodeURIComponent(r.executionId)}`}
                              >
                                Open
                              </Link>
                              <button
                                type="button"
                                onClick={() => {
                                  const ok = window.confirm(
                                    'Remove this DPQL run from history? This also deletes stored results (DB and/or disk file).'
                                  )
                                  if (!ok) return
                                  deleteRunMutation.mutate(r.executionId)
                                }}
                                disabled={deleteRunMutation.isPending}
                                className="ml-3 text-rose-600 hover:text-rose-700 text-sm font-semibold disabled:opacity-50"
                                title="Delete this run and its stored results"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {deleteRunMutation.isError ? (
              <div className="text-sm text-rose-700">Failed to remove DPQL run.</div>
            ) : null}
          </div>
        )}
      </section>
    </div>
  )
}
