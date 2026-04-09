import React, { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, Link } from 'react-router-dom'
import api from '../api/axios'
import { endpoints } from '../api/endpoints'
import { useDeleteAllExecutions, useDeleteExecution } from '../api/hooks'

type Algo = { id: number; name: string; fileName?: string; ind?: boolean; fd?: boolean; cid?: boolean; md?: boolean; cfd?: boolean; ucc?: boolean; cucc?: boolean; od?: boolean; mvd?: boolean; basicStat?: boolean; dc?: boolean }
type Result = { id: number; type?: string; typeName?: string; fileName?: string }
type InputRef = { name?: string; fileName?: string }
type Exec = {
  id: number
  identifier?: string
  begin?: number
  end?: number | null
  aborted?: boolean
  algorithm?: Algo
  results?: Result[]
  inputs?: InputRef[]
}

function formatDate(ts?: number) {
  if (!ts && ts !== 0) return '—'
  try { return new Date(ts).toLocaleString() } catch { return String(ts) }
}
function formatDuration(begin?: number, end?: number | null) {
  if (!begin) return '—'
  const stop = end ?? Date.now()
  const ms = Math.max(0, stop - begin)
  if (ms < 1000) return `${ms} ms`
  const seconds = ms / 1000
  if (seconds < 60) return `${seconds.toFixed(3)} s`
  const h = Math.floor(seconds / 3600)
  const mRem = Math.floor((seconds - h * 3600) / 60)
  const sRem = seconds - h * 3600 - mRem * 60
  if (h === 0) return `${mRem}m ${sRem.toFixed(3)}s`
  return `${h}h ${mRem}m ${sRem.toFixed(3)}s`
}

const RUN_POLL_INTERVAL_MS = 2000

export default function RunsList(){
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [confirmingDeleteAll, setConfirmingDeleteAll] = useState(false)
  const { data, isLoading, isError, refetch } = useQuery<Exec[]>({
    queryKey: ['executions'],
    queryFn: async () => {
      const { data } = await api.get(endpoints.executions.list)
      return data as Exec[]
    },
  })

  const stop = useMutation({
    mutationFn: async (identifier: string) => {
      await api.post(endpoints.algorithmExecution.stop(identifier))
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['executions'] }),
  })

  const del = useDeleteExecution()
  const deleteAll = useDeleteAllExecutions()

  const runs = useMemo(() => (data || []).slice().sort((a, b) => (b.begin || 0) - (a.begin || 0)), [data])
  const hasActiveRuns = useMemo(() => runs.some(isExecutionRunning), [runs])

  useEffect(() => {
    if (!hasActiveRuns) return
    const intervalId = window.setInterval(() => { refetch() }, RUN_POLL_INTERVAL_MS)
    return () => window.clearInterval(intervalId)
  }, [hasActiveRuns, refetch])

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold">Runs</h1>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          {confirmingDeleteAll ? (
            <div className="flex flex-col gap-2 rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700 sm:flex-row sm:items-center">
              <span>Are you sure? This removes all runs.</span>
              <div className="flex items-center gap-2">
                <button
                  className="rounded-md border border-red-400 bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                  onClick={() => deleteAll.mutate(undefined, { onSettled: () => setConfirmingDeleteAll(false) })}
                  disabled={deleteAll.isPending}
                >
                  {deleteAll.isPending ? 'Removing…' : 'Yes, remove all'}
                </button>
                <button
                  className="rounded-md border border-gray-300 px-3 py-1 text-xs"
                  onClick={() => setConfirmingDeleteAll(false)}
                  disabled={deleteAll.isPending}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="text-sm px-3 py-1.5 rounded-md border border-red-200 text-red-700 hover:bg-red-50"
              onClick={() => setConfirmingDeleteAll(true)}
              disabled={deleteAll.isPending || (runs.length === 0)}
            >
              Remove all runs
            </button>
          )}
          <Link to="/runs/new" className="text-sm px-3 py-1.5 rounded-md border border-gray-300 hover:bg-white" title="Start a new run">New run</Link>
        </div>
      </div>
      {isLoading && <div className="mt-2 text-sm text-muted">Loading runs…</div>}
      {isError && (
        <div className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Could not load runs. Ensure the backend is running.
        </div>
      )}
      {(!runs || runs.length === 0) ? (
        <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-4">
          <div className="font-medium text-gray-800">No runs yet</div>
          <div className="mt-1 text-gray-600">Start a new profiling run.</div>
          <div className="mt-3">
            <Link to="/runs/new" className="text-sm px-3 py-1.5 rounded-md border border-gray-300 hover:bg-white">New run</Link>
          </div>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full bg-white rounded-md shadow-sm">
            <thead>
              <tr className="text-left text-sm text-muted border-b">
                <th className="px-3 py-2">Algorithm</th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Execution time</th>
                <th className="px-3 py-2">Inputs</th>
                <th className="px-3 py-2">Result type</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => {
                const running = isExecutionRunning(r)
                return (
                  <tr
                    key={r.id}
                    className="group border-b last:border-b-0 text-sm cursor-pointer hover:bg-gray-50"
                    onClick={() => {
                      const suffix = r.identifier ? `?identifier=${encodeURIComponent(r.identifier)}` : ''
                      navigate(`/results/execution/${r.id}${suffix}`)
                    }}
                    title="View results"
                  >
                    <td className="px-3 py-2 whitespace-nowrap">{algoLabel(r.algorithm)}</td>
                    <td className="px-3 py-2">{formatDate(r.begin)}</td>
                    <td className="px-3 py-2">{formatDuration(r.begin, r.end ?? null)}</td>
                    <td className="px-3 py-2 whitespace-nowrap" title={(r.inputs||[]).map(i=>formatInputLong(i)).join(', ')}>
                      {formatInputsShort(r.inputs)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <ResultTypeCell executionId={r.id} running={running} algo={r.algorithm} />
                        {running && r.identifier && (
                          <button
                            className="shrink-0 rounded px-2 py-1 text-xs text-amber-700 hover:text-amber-800 hover:bg-amber-50 border border-transparent hover:border-amber-200 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                            title="Stop run"
                            onClick={(e) => { e.stopPropagation(); stop.mutate(r.identifier as string) }}
                            disabled={stop.isPending}
                          >
                            {stop.isPending ? 'Stopping…' : 'Stop'}
                          </button>
                        )}
                        <button
                          className="shrink-0 rounded px-2 py-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 border border-transparent hover:border-red-200 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                          title="Delete run"
                          onClick={(e) => { e.stopPropagation(); if (confirm('Delete this run? This will remove the execution and its results from disk.')) del.mutate(r.id) }}
                          disabled={del.isPending}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function ResultTypeCell({ executionId, running, algo }: { executionId: number; running: boolean; algo?: Algo }) {
  const [detailsRequested, setDetailsRequested] = useState(false)
  const primary = algoPrimaryType(algo)
  const shouldFetch = detailsRequested && !running
  // Only fetch heavy result counters when explicitly requested and execution has finished
  const { data, isLoading, isError } = useQuery<{ [k: string]: number }>({
    queryKey: ['executionResultsCount', executionId],
    queryFn: async () => {
      const { data } = await api.get(endpoints.executions.countResults(executionId))
      return data as any
    },
    enabled: shouldFetch,
    staleTime: 1000 * 60 * 60, // cache for 1h to avoid redundant reprocessing
    refetchOnWindowFocus: false,
  })
  if (running) return <span className="text-muted">{primary || '—'}</span>
  if (!detailsRequested) {
    return (
      <div className="flex items-center gap-2">
        <span>{primary || '—'}</span>
        <button
          type="button"
          className="text-xs text-primary underline decoration-dotted"
          onClick={(e) => { e.stopPropagation(); setDetailsRequested(true) }}
          title="Load result summary"
        >
          Show results
        </button>
      </div>
    )
  }
  if (isLoading) return <span className="text-muted">Loading…</span>
  if (isError || !data) return <span>{primary || '—'}</span>
  const entries = Object.entries(data)
  const types = entries.filter(([,v]) => (v || 0) > 0).map(([k]) => k)
  const label = types.length > 0 ? types.join(', ') : (primary || '—')
  const title = entries.length > 0 ? entries.map(([k,v])=>`${k}: ${v}`).join('\n') : (primary || '—')
  return <span title={title}>{label}</span>
}

function isExecutionRunning(exec?: Exec) {
  if (!exec) return false
  return !exec.end && !exec.aborted
}

function algoPrimaryType(algo?: Algo) {
  if (!algo) return ''
  const order: Array<[keyof Algo, string]> = [
    ['ind','Inclusion Dependency'],
    ['fd','Functional Dependency'],
    ['ucc','Unique Column Combination'],
    ['od','Order Dependency'],
    ['mvd','Multivalued Dependency'],
    ['dc','Denial Constraint'],
    ['cid','Conditional Inclusion Dependency'],
    ['cfd','Conditional Functional Dependency'],
    ['md','Matching Dependency'],
    ['basicStat','Basic Statistic'],
    ['cucc','Conditional Unique Column Combination']
  ]
  const found = order.find(([k]) => (algo as any)[k])
  return found ? found[1] : ''
}

function algoLabel(algo?: Algo) {
  if (!algo) return '—'
  const name = (algo.name && algo.name.trim()) || ''
  if (name) return name
  const fn = (algo.fileName && algo.fileName.trim()) || ''
  if (fn) return baseName(fn) || fn
  return `Algorithm ${algo.id ?? ''}`.trim()
}

function baseName(p?: string) {
  if (!p) return ''
  const parts = p.split(/[/\\]/)
  return parts[parts.length - 1]
}

function formatInputLong(i?: InputRef) {
  if (!i) return ''
  return i.name || i.fileName || ''
}

function formatInputsShort(inputs?: InputRef[]) {
  if (!Array.isArray(inputs) || inputs.length === 0) return '—'
  const names = inputs.map(i => baseName(i.name || i.fileName || ''))
  if (names.length <= 2) return names.join(', ')
  return `${names.slice(0,2).join(', ')} +${names.length - 2} more`
}
