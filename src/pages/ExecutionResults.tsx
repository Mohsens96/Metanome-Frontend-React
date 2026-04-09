import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import api from '../api/axios'
import { endpoints } from '../api/endpoints'
import { useFdPrefixTree } from '../components/fd-visualizations/useFdPrefixTree'
import { FdVisualizationPanel } from '../components/fd-visualizations/FdVisualizationPanel'

type ColumnIdentifier = { tableIdentifier?: string; columnIdentifier?: string }
type ColumnPermutation = { columnIdentifiers?: ColumnIdentifier[] }
type RankingResult = Record<string, any>
type BasicStatisticValue = { value?: number | string; formattedValue?: string; [key: string]: any }

type Algo = {
  id: number
  name?: string
  fileName?: string
  ind?: boolean
  fd?: boolean
  cid?: boolean
  md?: boolean
  cfd?: boolean
  ucc?: boolean
  cucc?: boolean
  od?: boolean
  mvd?: boolean
  basicStat?: boolean
  dc?: boolean
}

type Execution = {
  id: number
  begin?: number
  end?: number | null
  aborted?: boolean
  identifier?: string
  algorithm?: Algo
  results?: Array<{ typeName?: string; type?: string }>
}

type ResultTypeConfig = {
  flagKey: keyof Algo
  storeType: string
  label: string
  sortProperty: string
  sortOrder: boolean
}

const RESULT_TYPES: ResultTypeConfig[] = [
  {
    flagKey: 'basicStat',
    storeType: 'Basic Statistic',
    label: 'Basic Statistics',
    sortProperty: 'uniqueness_ratio',
    sortOrder: false,
  },
  {
    flagKey: 'ucc',
    storeType: 'Unique Column Combination',
    label: 'Unique Column Combinations',
    sortProperty: 'uniqueness_ratio',
    sortOrder: false,
  },
  {
    flagKey: 'cucc',
    storeType: 'Conditional Unique Column Combination',
    label: 'Conditional Unique Column Combinations',
    sortProperty: 'column_combination',
    sortOrder: false,
  },
  {
    flagKey: 'ind',
    storeType: 'Inclusion Dependency',
    label: 'Inclusion Dependencies',
    sortProperty: 'coverage',
    sortOrder: false,
  },
  {
    flagKey: 'fd',
    storeType: 'Functional Dependency',
    label: 'Functional Dependencies',
    sortProperty: 'coverage',
    sortOrder: false,
  },
  {
    flagKey: 'cid',
    storeType: 'Conditional Inclusion Dependency',
    label: 'Conditional Inclusion Dependencies',
    sortProperty: 'dependant',
    sortOrder: false,
  },
  {
    flagKey: 'md',
    storeType: 'Matching Dependency',
    label: 'Matching Dependencies',
    sortProperty: 'determinant',
    sortOrder: false,
  },
  {
    flagKey: 'cfd',
    storeType: 'Conditional Functional Dependency',
    label: 'Conditional Functional Dependencies',
    sortProperty: 'determinant',
    sortOrder: false,
  },
  {
    flagKey: 'od',
    storeType: 'Order Dependency',
    label: 'Order Dependencies',
    sortProperty: 'lhs',
    sortOrder: false,
  },
  {
    flagKey: 'mvd',
    storeType: 'Multivalued Dependency',
    label: 'Multivalued Dependencies',
    sortProperty: 'coverage',
    sortOrder: false,
  },
  {
    flagKey: 'dc',
    storeType: 'Denial Constraint',
    label: 'Denial Constraints',
    sortProperty: 'predicates',
    sortOrder: false,
  },
]

export default function ExecutionResults() {
  const location = useLocation()
  const navigate = useNavigate()
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const identifierFromQuery = searchParams.get('identifier') ?? undefined
  const isExtended = searchParams.get('extended') === 'true'
  const executionId = Number(id)
  const [selectedStoreType, setSelectedStoreType] = useState<string | null>(null)
  const [pollUntil, setPollUntil] = useState<number>(() => Date.now() + 60000)
  const [didLoadOnce, setDidLoadOnce] = useState<boolean>(false)
  const [showFdVisualizations, setShowFdVisualizations] = useState<boolean>(() => {
    try {
      const raw = window.localStorage.getItem('metanome:fdViz:show')
      return raw === 'true'
    } catch {
      return false
    }
  })

  const execQuery = useQuery<Execution | null>({
    queryKey: ['execution', executionId, identifierFromQuery],
    queryFn: async () => {
      const hasNumericId = !!executionId && !Number.isNaN(executionId)
      if (hasNumericId) {
        try {
          const { data } = await api.get(endpoints.executions.get(executionId))
          if (data) {
            return data as Execution
          }
        } catch (err) {
          const axiosErr = err as AxiosError<any>
          const status = axiosErr.response?.status
          if (status && status !== 404) {
            throw err
          }
        }
      }
      if (identifierFromQuery) {
        const { data } = await api.get(endpoints.executions.getByIdentifier(identifierFromQuery))
        return data as Execution
      }
      return null
    },
    enabled: (!!executionId && !Number.isNaN(executionId)) || !!identifierFromQuery,
    refetchInterval: (q) => {
      const e = q.state.data as Execution | null | undefined
      const running = !e || (!e.end && !e.aborted)
      return running ? 1000 : false
    },
    staleTime: 0,
    refetchOnWindowFocus: false,
  })

  const execution = execQuery.data ?? undefined
  const resolvedExecutionId = execution?.id ?? (!Number.isNaN(executionId) ? executionId : undefined)
  const numericExecutionId = resolvedExecutionId && !Number.isNaN(resolvedExecutionId) ? resolvedExecutionId : undefined
  const identifier = execution?.identifier || identifierFromQuery || null
  const displayExecutionId = execution?.id ?? (!Number.isNaN(executionId) ? executionId : undefined)
  const algorithm = execution?.algorithm
  const isRunning = !execution || (!execution.end && !execution.aborted)
  const isAborted = !!execution?.aborted
  const isFinished = !!execution && !!execution.end && !execution.aborted

  const availableTypes = useMemo(() => {
    // Prefer the actual result types recorded for this execution (more reliable than algorithm flags,
    // which might be missing in some Execution API responses).
    const execResultTypes = new Set<string>()
    for (const r of execution?.results || []) {
      if (typeof r?.typeName === 'string' && r.typeName.trim().length > 0) {
        execResultTypes.add(r.typeName)
      }
    }
    if (execResultTypes.size > 0) {
      const fromResults = RESULT_TYPES.filter((cfg) => execResultTypes.has(cfg.storeType))
      if (fromResults.length > 0) {
        return fromResults
      }
    }

    if (!algorithm) {
      return RESULT_TYPES
    }
    const filtered = RESULT_TYPES.filter((cfg) => (algorithm as any)[cfg.flagKey])
    return filtered.length > 0 ? filtered : RESULT_TYPES
  }, [algorithm, execution?.results])

  useEffect(() => {
    if (!availableTypes.length) {
      setSelectedStoreType(null)
      return
    }
    if (!selectedStoreType || !availableTypes.some((cfg) => cfg.storeType === selectedStoreType)) {
      setSelectedStoreType(availableTypes[0].storeType)
    }
  }, [availableTypes, selectedStoreType])

  const activeType = useMemo(() => {
    if (!availableTypes.length) {
      return null
    }
    return availableTypes.find((cfg) => cfg.storeType === selectedStoreType) || availableTypes[0]
  }, [availableTypes, selectedStoreType])

  const supportsExtendedResult = useMemo(() => {
    const storeType = activeType?.storeType
    if (!storeType) return false
    return storeType !== 'Denial Constraint' && storeType !== 'Conditional Functional Dependency'
  }, [activeType?.storeType])

  useEffect(() => {
    setPollUntil(Date.now() + 60000)
  }, [numericExecutionId, activeType?.storeType])

  useEffect(() => {
    setDidLoadOnce(false)
  }, [numericExecutionId])

  useEffect(() => {
    if (!execution || !execution.id) return
    const numericParamValid = !Number.isNaN(executionId) && executionId === execution.id
    const desiredIdentifier = execution.identifier || identifierFromQuery || ''
    const currentIdentifier = identifierFromQuery || ''
    if (numericParamValid && desiredIdentifier === currentIdentifier) {
      return
    }
    const params = new URLSearchParams()
    if (desiredIdentifier) {
      params.set('identifier', desiredIdentifier)
    }
    const query = params.toString()
    navigate(`/results/execution/${execution.id}${query ? `?${query}` : ''}`, { replace: true })
  }, [execution, executionId, identifierFromQuery, navigate])

  const loadUsingIdentifier = async (): Promise<'dependent' | 'independent'> => {
    if (!identifier) {
      throw new Error('Execution identifier unavailable')
    }
    try {
      await api.post(endpoints.resultStore.loadExecutionByIdentifier(identifier, false))
      return 'dependent'
    } catch (err) {
      const axiosErr = err as AxiosError<any>
      if (shouldFallbackToDataIndependent(axiosErr)) {
        await api.post(endpoints.resultStore.loadExecutionByIdentifier(identifier, true))
        return 'independent'
      }
      throw axiosErr
    }
  }

  const loadExec = useMutation<'dependent' | 'independent', AxiosError<any>>({
    mutationFn: async () => {
      if (numericExecutionId != null) {
        try {
          await api.post(endpoints.resultStore.loadExecution(numericExecutionId, false))
          return 'dependent'
        } catch (err) {
          const axiosErr = err as AxiosError<any>
          if (shouldFallbackToDataIndependent(axiosErr)) {
            try {
              await api.post(endpoints.resultStore.loadExecution(numericExecutionId, true))
              return 'independent'
            } catch (innerErr) {
              const inner = innerErr as AxiosError<any>
              if (inner.response?.status === 404 && identifier) {
                return loadUsingIdentifier()
              }
              throw inner
            }
          }
          if (axiosErr.response?.status === 404 && identifier) {
            return loadUsingIdentifier()
          }
          throw axiosErr
        }
      }
      if (identifier) {
        return loadUsingIdentifier()
      }
      throw new Error('Invalid execution reference')
    },
    onSuccess: () => {
      setPollUntil(Date.now() + 60000)
    },
  })

  const loadExecErrorMessage = useMemo(() => {
    if (!loadExec.isError || !loadExec.error) return null
    const err = loadExec.error as AxiosError<any>
    if (!err.response) {
      const apiBase = api.defaults.baseURL?.replace(/\/$/, '') ?? 'the backend service'
      return `Unable to reach ${apiBase}. Please ensure the backend server is running and reachable.`
    }
    const status = err.response?.status
    const backendText = resolveBackendMessage(err.response?.data)
    const fallbackMsg = err.message || 'Request failed'

    const isNoResultsMessage =
      backendText.includes('No result files stored for execution') ||
      (backendText.includes('Execution with id') && backendText.includes('not found')) ||
      (backendText.includes('Execution with identifier') && backendText.includes('not found'))

    if ((status === 404 || status === 400) && isNoResultsMessage) {
      return 'No stored results were found for this execution yet.'
    }

    if (status === 404) {
      if (backendText.trim().length > 0) {
        return backendText
      }
      return 'No stored results were found for this execution yet.'
    }

    if (backendText.trim().length > 0) {
      return backendText
    }

    return `Could not load execution results from the backend. (${fallbackMsg})`
  }, [loadExec.error, loadExec.isError])

  useEffect(() => {
    if (!numericExecutionId && !identifier) return
    if (isFinished && !didLoadOnce) {
      setDidLoadOnce(true)
      loadExec.mutate()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numericExecutionId, identifier, isFinished, didLoadOnce])

  const storeCountQuery = useQuery<number>({
    queryKey: ['resultStoreCount', numericExecutionId, activeType?.storeType, loadExec.isSuccess],
    queryFn: async () => {
      if (!activeType || numericExecutionId == null) return 0
      const { data } = await api.get(endpoints.resultStore.count(activeType.storeType))
      return Number(data) || 0
    },
    enabled: numericExecutionId != null && !!activeType && loadExec.isSuccess,
    retry: 1,
    refetchOnWindowFocus: false,
    staleTime: 0,
    refetchInterval: (q) => {
      const now = Date.now()
      const current = (q.state.data as number | undefined) ?? 0
      if (isFinished && current === 0) return false
      return now < pollUntil && current === 0 ? 1000 : false
    },
  })

  const {
    data: resultsData = [],
    isLoading: isResultsLoading,
    isError: isResultsError,
    refetch: refetchResults,
    isFetching: isFetchingResults,
  } = useQuery<RankingResult[]>({
    queryKey: ['executionResults', numericExecutionId, activeType?.storeType],
    queryFn: async () => {
      if (!activeType) return []
      const { storeType, sortProperty, sortOrder } = activeType
      const { data } = await api.get(endpoints.resultStore.getFromTo(storeType, sortProperty, String(sortOrder), 0, 200))
      return Array.isArray(data) ? (data as RankingResult[]) : []
    },
    enabled: numericExecutionId != null && !!activeType && loadExec.isSuccess,
    retry: 2,
    refetchOnWindowFocus: false,
    staleTime: 0,
    refetchInterval: (q) => {
      const now = Date.now()
      const arr = q.state.data as RankingResult[] | undefined
      const empty = !Array.isArray(arr) || arr.length === 0
      if (isFinished && empty) return false
      return now < pollUntil && empty ? 1000 : false
    },
  })

  const refetchStoreCount = storeCountQuery.refetch

  useEffect(() => {
    if (!loadExec.isSuccess || !activeType || numericExecutionId == null) return
    void refetchStoreCount()
    void refetchResults()
  }, [loadExec.isSuccess, activeType?.storeType, numericExecutionId, refetchStoreCount, refetchResults])

  const totalResults = storeCountQuery.data ?? 0

  const waitingForResults = useMemo(() => {
    const now = Date.now()
    const arrayData = Array.isArray(resultsData) ? resultsData : []
    if (!loadExec.isSuccess) return false
    if (isResultsError) return false
    // If the run is finished and count is known to be 0, don't keep showing "waiting".
    if (isFinished && storeCountQuery.isSuccess && totalResults === 0) return false
    return now < pollUntil && (totalResults === 0 || arrayData.length === 0)
  }, [resultsData, loadExec.isSuccess, pollUntil, totalResults, isResultsError, isFinished, storeCountQuery.isSuccess])

  const resultsTable = useMemo(() => {
    if (!Array.isArray(resultsData) || resultsData.length === 0) return null
    const firstType = resultsData[0]?.type
    if (firstType === 'FunctionalDependencyResult') {
      return renderFunctionalDependencyTable(resultsData, isExtended)
    }
    if (firstType === 'UniqueColumnCombinationResult') {
      return renderUniqueColumnCombinationTable(resultsData, isExtended)
    }
    if (firstType === 'InclusionDependencyResult') {
      return renderInclusionDependencyTable(resultsData, isExtended)
    }
    if (firstType === 'ConditionalInclusionDependencyResult') {
      return renderConditionalInclusionDependencyTable(resultsData, isExtended)
    }
    if (firstType === 'MatchingDependencyResult') {
      return renderMatchingDependencyTable(resultsData, isExtended)
    }
    if (firstType === 'ConditionalFunctionalDependencyResult') {
      return renderConditionalFunctionalDependencyTable(resultsData)
    }
    if (firstType === 'ConditionalUniqueColumnCombinationResult') {
      return renderConditionalUniqueColumnCombinationTable(resultsData, isExtended)
    }
    if (firstType === 'OrderDependencyResult') {
      return renderOrderDependencyTable(resultsData, isExtended)
    }
    if (firstType === 'MultivaluedDependencyResult') {
      return renderMultivaluedDependencyTable(resultsData, isExtended)
    }
    if (firstType === 'BasicStatisticResult') {
      return renderBasicStatisticTable(resultsData, isExtended)
    }
    if (firstType === 'DenialConstraintResult') {
      return renderDenialConstraintTable(resultsData)
    }
    return renderFallback(resultsData)
  }, [resultsData, isExtended])

  const isFdView = Array.isArray(resultsData) && resultsData.length > 0 && resultsData[0]?.type === 'FunctionalDependencyResult'
  const shouldLoadFdViz = isFdView && isFinished && showFdVisualizations
  const fdPrefixTreeQuery = useFdPrefixTree(numericExecutionId ?? null, shouldLoadFdViz)

  useEffect(() => {
    try {
      window.localStorage.setItem('metanome:fdViz:show', String(showFdVisualizations))
    } catch {
      // ignore
    }
  }, [showFdVisualizations])

  const enableExtendedResults = () => {
    const params = new URLSearchParams(searchParams)
    params.set('extended', 'true')
    const query = params.toString()
    navigate(`${location.pathname}${query ? `?${query}` : ''}`)
  }

  const disableExtendedResults = () => {
    const params = new URLSearchParams(searchParams)
    params.delete('extended')
    const query = params.toString()
    navigate(`${location.pathname}${query ? `?${query}` : ''}`)
  }

  return (
    <div>
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold">{activeType?.label || 'Execution Results'}</h1>
          <p className="text-sm text-muted">
            Execution ID: {displayExecutionId ?? '—'}
            {identifier ? ` | Identifier: ${identifier}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {availableTypes.length > 1 && (
            <select
              className="text-sm border border-gray-300 rounded px-2 py-1 bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              value={selectedStoreType || ''}
              onChange={(e) => setSelectedStoreType(e.target.value || null)}
            >
              {availableTypes.map((cfg) => (
                <option key={cfg.storeType} value={cfg.storeType}>
                  {cfg.label}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={() => refetchResults()}
            disabled={isFetchingResults}
            className="text-sm px-3 py-1.5 rounded-md border border-gray-300 disabled:opacity-60"
          >
            {isFetchingResults ? 'Refreshing…' : 'Refresh'}
          </button>
          {supportsExtendedResult && isFinished && !isExtended && (
            <button
              onClick={enableExtendedResults}
              className="text-sm px-3 py-1.5 rounded-md border border-gray-300 disabled:opacity-60"
            >
              Load extended result
            </button>
          )}
          {supportsExtendedResult && isFinished && isExtended && (
            <button
              onClick={disableExtendedResults}
              className="text-sm px-3 py-1.5 rounded-md border border-gray-300 disabled:opacity-60"
            >
              Show normal result
            </button>
          )}
        </div>
      </div>

      {isRunning && (
        <div className="mt-2 text-sm text-muted">Execution is still running… results will appear once finished.</div>
      )}
      {isAborted && (
        <div className="mt-2 text-sm text-muted">Execution was aborted. No results available.</div>
      )}
      {loadExec.isPending && (
        <div className="mt-2 text-sm text-muted">Loading execution results…</div>
      )}
      {loadExec.isError && loadExecErrorMessage && (
        <div className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex flex-col gap-2">
          <span>{loadExecErrorMessage}</span>
          <button
            onClick={() => loadExec.mutate()}
            disabled={loadExec.isPending}
            className="self-start text-xs px-3 py-1 rounded-md border border-red-300 bg-white text-red-700 hover:bg-red-100 disabled:opacity-60"
          >
            {loadExec.isPending ? 'Retrying…' : 'Try loading again'}
          </button>
        </div>
      )}
      {isResultsLoading && (
        <div className="mt-2 text-sm text-muted">Loading results…</div>
      )}
      {waitingForResults && (
        <div className="mt-2 text-sm text-muted">Waiting for results…</div>
      )}
      {isResultsError && (
        <div className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Could not load results.
        </div>
      )}
      {storeCountQuery.isError && (
        <div className="mt-3 rounded border border-gray-200 bg-gray-50 p-3 text-sm text-muted">
          No results found for {activeType?.label ?? 'this type'}.
        </div>
      )}
      {storeCountQuery.isSuccess && totalResults === 0 && !waitingForResults && (
        <div className="mt-3 rounded border border-gray-200 bg-gray-50 p-3 text-sm text-muted">
          No results found for {activeType?.label ?? 'this type'}.
        </div>
      )}

      {totalResults > 0 && (
        <div className="mt-3 text-sm text-muted">Total results: {totalResults}</div>
      )}

      {isFdView && isFinished && (
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowFdVisualizations((v) => !v)}
            className="text-sm px-3 py-1.5 rounded-md border border-gray-300 disabled:opacity-60"
          >
            {showFdVisualizations ? 'Hide visualizations' : 'Show visualizations'}
          </button>
          <span className="text-xs text-muted">Sunburst / Circle Packing / Prefix Tree</span>
        </div>
      )}

      {shouldLoadFdViz && fdPrefixTreeQuery.isSuccess && fdPrefixTreeQuery.data && (
        <FdVisualizationPanel data={fdPrefixTreeQuery.data} />
      )}
      {shouldLoadFdViz && fdPrefixTreeQuery.isError && (
        <div className="mt-3 rounded border border-gray-200 bg-gray-50 p-3 text-sm text-muted">
          FD visualization data not available.
        </div>
      )}
      {shouldLoadFdViz && fdPrefixTreeQuery.isLoading && (
        <div className="mt-3 rounded border border-gray-200 bg-gray-50 p-3 text-sm text-muted">
          Loading FD visualizations…
        </div>
      )}

      {resultsTable}
    </div>
  )
}

function renderFunctionalDependencyTable(data: RankingResult[], isExtended: boolean) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="min-w-full bg-white rounded-md shadow-sm">
        <thead>
          <tr className="text-left text-sm text-muted border-b">
            <th className="px-3 py-2">Determinant</th>
            <th className="px-3 py-2">Dependant</th>
            {isExtended && <th className="px-3 py-2">Extended Dependant</th>}
            {isExtended && <th className="px-3 py-2">Determinant Column Ratio</th>}
            {isExtended && <th className="px-3 py-2">Dependant Column Ratio</th>}
            {isExtended && <th className="px-3 py-2">Determinant Occurrence Ratio</th>}
            {isExtended && <th className="px-3 py-2">Dependant Occurrence Ratio</th>}
            {isExtended && <th className="px-3 py-2">General Coverage</th>}
            {isExtended && <th className="px-3 py-2">Determinant Uniqueness Ratio</th>}
            {isExtended && <th className="px-3 py-2">Dependant Uniqueness Ratio</th>}
            {isExtended && <th className="px-3 py-2">Information Gain Cell</th>}
            {isExtended && <th className="px-3 py-2">Information Gain Byte</th>}
            {isExtended && <th className="px-3 py-2">Pollution</th>}
            {isExtended && <th className="px-3 py-2">Pollution Column</th>}
          </tr>
        </thead>
        <tbody>
          {data.map((r, idx) => {
            const determinant = extractRankingValue(r, ['determinant'])
            const dependant = extractRankingValue(r, ['dependant', 'dependent'])
            const extendedDependant = extractRankingValue(r, [
              'extendedDependant',
              'extended_dependant',
              'extendedDependent',
              'extended_dependent',
            ])
            const detColRatio = extractRankingMetric(r, 'determinantColumnRatio', 'determinant_column_ratio')
            const depColRatio = extractRankingMetric(r, 'dependantColumnRatio', 'dependant_column_ratio')
            const detOcc = r.determinantOccurrenceRatio ?? r.result?.determinantOccurrenceRatio
            const depOcc = r.dependantOccurrenceRatio ?? r.result?.dependantOccurrenceRatio
            const coverage = extractRankingMetric(r, 'generalCoverage', 'general_coverage')
            const detUnique = extractRankingMetric(r, 'determinantUniquenessRatio', 'determinant_uniqueness_ratio')
            const depUnique = extractRankingMetric(r, 'dependantUniquenessRatio', 'dependant_uniqueness_ratio')
            const informationGainCell = extractRankingMetric(r, 'informationGainCell', 'information_gain_cell')
            const informationGainByte = extractRankingMetric(r, 'informationGainByte', 'information_gain_byte')
            const pollution = extractRankingMetric(r, 'pollution', 'pollution')
            const pollutionColumn = extractRankingValue(r, ['pollutionColumn', 'pollution_column'])

            return (
              <tr key={idx} className="border-b last:border-b-0 text-sm">
                <td className="px-3 py-2 whitespace-nowrap">{fmtLooseColumn(determinant)}</td>
                <td className="px-3 py-2 whitespace-nowrap">{fmtLooseColumn(dependant)}</td>
                {isExtended && <td className="px-3 py-2 whitespace-nowrap">{fmtLooseColumn(extendedDependant)}</td>}
                {isExtended && <td className="px-3 py-2">{fmtRatio(detColRatio)}</td>}
                {isExtended && <td className="px-3 py-2">{fmtRatio(depColRatio)}</td>}
                {isExtended && <td className="px-3 py-2">{fmtRatio(detOcc)}</td>}
                {isExtended && <td className="px-3 py-2">{fmtRatio(depOcc)}</td>}
                {isExtended && <td className="px-3 py-2">{fmtRatio(coverage)}</td>}
                {isExtended && <td className="px-3 py-2">{fmtRatio(detUnique)}</td>}
                {isExtended && <td className="px-3 py-2">{fmtRatio(depUnique)}</td>}
                {isExtended && <td className="px-3 py-2">{fmtGenericOrDash(informationGainCell)}</td>}
                {isExtended && <td className="px-3 py-2">{fmtGenericOrDash(informationGainByte)}</td>}
                {isExtended && <td className="px-3 py-2">{fmtGenericOrDash(pollution)}</td>}
                {isExtended && <td className="px-3 py-2 whitespace-nowrap">{fmtLooseColumn(pollutionColumn)}</td>}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function renderInclusionDependencyTable(data: RankingResult[], isExtended: boolean) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="min-w-full bg-white rounded-md shadow-sm">
        <thead>
          <tr className="text-left text-sm text-muted border-b">
            <th className="px-3 py-2">Dependant</th>
            <th className="px-3 py-2">Referenced</th>
            {isExtended && <th className="px-3 py-2">Dependant Column Ratio</th>}
            {isExtended && <th className="px-3 py-2">Referenced Column Ratio</th>}
            {isExtended && <th className="px-3 py-2">Dependant Occurrence Ratio</th>}
            {isExtended && <th className="px-3 py-2">Referenced Occurrence Ratio</th>}
            {isExtended && <th className="px-3 py-2">Dependant Uniqueness Ratio</th>}
            {isExtended && <th className="px-3 py-2">Referenced Uniqueness Ratio</th>}
          </tr>
        </thead>
        <tbody>
          {data.map((r, idx) => {
            const dependant = r.dependant || r.result?.dependant
            const referenced = r.referenced || r.result?.referenced

            const pickMetric = (keyPairs: Array<[string, string]>): number | null => {
              for (const [camel, snake] of keyPairs) {
                const value = extractRankingMetric(r, camel, snake)
                if (value != null) return value
              }
              return null
            }

            const dependantColumnRatio = pickMetric([
              ['dependantColumnRatio', 'dependant_column_ratio'],
              ['dependentColumnRatio', 'dependent_column_ratio'],
            ])
            const referencedColumnRatio = pickMetric([
              ['referencedColumnRatio', 'referenced_column_ratio'],
            ])
            const dependantOccurrenceRatio = pickMetric([
              ['dependantOccurrenceRatio', 'dependant_occurrence_ratio'],
              ['dependentOccurrenceRatio', 'dependent_occurrence_ratio'],
            ])
            const referencedOccurrenceRatio = pickMetric([
              ['referencedOccurrenceRatio', 'referenced_occurrence_ratio'],
            ])
            const dependantUniquenessRatio = pickMetric([
              ['dependantUniquenessRatio', 'dependant_uniqueness_ratio'],
              ['dependentUniquenessRatio', 'dependent_uniqueness_ratio'],
            ])
            const referencedUniquenessRatio = pickMetric([
              ['referencedUniquenessRatio', 'referenced_uniqueness_ratio'],
            ])

            return (
              <tr key={idx} className="border-b last:border-b-0 text-sm">
                <td className="px-3 py-2 whitespace-nowrap">{fmtPermutation(dependant)}</td>
                <td className="px-3 py-2 whitespace-nowrap">{fmtPermutation(referenced)}</td>
                {isExtended && <td className="px-3 py-2">{fmtRatio(dependantColumnRatio)}</td>}
                {isExtended && <td className="px-3 py-2">{fmtRatio(referencedColumnRatio)}</td>}
                {isExtended && <td className="px-3 py-2">{fmtRatio(dependantOccurrenceRatio)}</td>}
                {isExtended && <td className="px-3 py-2">{fmtRatio(referencedOccurrenceRatio)}</td>}
                {isExtended && <td className="px-3 py-2">{fmtRatio(dependantUniquenessRatio)}</td>}
                {isExtended && <td className="px-3 py-2">{fmtRatio(referencedUniquenessRatio)}</td>}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function renderConditionalInclusionDependencyTable(data: RankingResult[], isExtended: boolean) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="min-w-full bg-white rounded-md shadow-sm">
        <thead>
          <tr className="text-left text-sm text-muted border-b">
            <th className="px-3 py-2">Determinant</th>
            <th className="px-3 py-2">Dependant</th>
            {isExtended && <th className="px-3 py-2">Extended Dependant</th>}
          </tr>
        </thead>
        <tbody>
          {data.map((r, idx) => {
            const determinant = extractRankingValue(r, ['determinant'])
            const dependant = extractRankingValue(r, ['dependant', 'dependent'])
            const extendedDependant = extractRankingValue(r, [
              'extendedDependant',
              'extended_dependant',
              'extendedDependent',
              'extended_dependent',
            ])

            return (
              <tr key={idx} className="border-b last:border-b-0 text-sm">
                <td className="px-3 py-2 whitespace-nowrap">{fmtLooseColumn(determinant)}</td>
                <td className="px-3 py-2 whitespace-nowrap">{fmtLooseColumn(dependant)}</td>
                {isExtended && <td className="px-3 py-2 whitespace-nowrap">{fmtLooseColumn(extendedDependant)}</td>}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function renderMatchingDependencyTable(data: RankingResult[], isExtended: boolean) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="min-w-full bg-white rounded-md shadow-sm">
        <thead>
          <tr className="text-left text-sm text-muted border-b">
            <th className="px-3 py-2">Determinant</th>
            <th className="px-3 py-2">Dependant</th>
            {isExtended && <th className="px-3 py-2">Support</th>}
          </tr>
        </thead>
        <tbody>
          {data.map((r, idx) => {
            const determinantRaw = r?.result?.determinant?.matchingIdentifiers
            const determinant = Array.isArray(determinantRaw)
              ? determinantRaw
                  .map((m: any) => formatMatchingIdentifier(m))
                  .filter((v: string) => v.length > 0)
                  .join(', ')
              : ''

            const dependant = formatMatchingIdentifier(r?.result?.dependant)
            const support = r?.result?.support ?? r.support

            return (
              <tr key={idx} className="border-b last:border-b-0 text-sm">
                <td className="px-3 py-2 whitespace-nowrap">{determinant || '—'}</td>
                <td className="px-3 py-2 whitespace-nowrap">{dependant || '—'}</td>
                {isExtended && <td className="px-3 py-2">{fmtGenericOrDash(support)}</td>}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function renderConditionalFunctionalDependencyTable(data: RankingResult[]) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="min-w-full bg-white rounded-md shadow-sm">
        <thead>
          <tr className="text-left text-sm text-muted border-b">
            <th className="px-3 py-2">Determinant</th>
            <th className="px-3 py-2">Dependant</th>
            <th className="px-3 py-2">Pattern Tableau</th>
          </tr>
        </thead>
        <tbody>
          {data.map((r, idx) => {
            const determinant = extractRankingValue(r, ['determinant'])
            const dependant = extractRankingValue(r, ['dependant', 'dependent'])
            const tableau = extractRankingValue(r, ['tableau', 'patternTableau', 'pattern_tableau'])

            return (
              <tr key={idx} className="border-b last:border-b-0 text-sm align-top">
                <td className="px-3 py-2 whitespace-nowrap">{fmtLooseColumn(determinant)}</td>
                <td className="px-3 py-2 whitespace-nowrap">{fmtLooseColumn(dependant)}</td>
                <td className="px-3 py-2 whitespace-pre-wrap">{fmtGenericOrDash(tableau)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function renderConditionalUniqueColumnCombinationTable(data: RankingResult[], isExtended: boolean) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="min-w-full bg-white rounded-md shadow-sm">
        <thead>
          <tr className="text-left text-sm text-muted border-b">
            <th className="px-3 py-2">Column Combination</th>
            <th className="px-3 py-2">Condition</th>
            <th className="px-3 py-2">Coverage</th>
            {isExtended && <th className="px-3 py-2">Column Ratio</th>}
            {isExtended && <th className="px-3 py-2">Occurrence Ratio</th>}
            {isExtended && <th className="px-3 py-2">Uniqueness Ratio</th>}
          </tr>
        </thead>
        <tbody>
          {data.map((r, idx) => {
            const cc = r.columnCombination || r.result?.columnCombination
            const condition = r?.result?.condition || r.condition
            const coverage = condition?.coverage ?? r.coverage
            const columnRatio = extractRankingMetric(r, 'columnRatio', 'column_ratio')
            const occurrenceRatio = extractRankingMetric(r, 'occurrenceRatio', 'occurrence_ratio')
            const uniquenessRatio = extractRankingMetric(r, 'uniquenessRatio', 'uniqueness_ratio')

            const conditionText = formatCuccCondition(condition)

            return (
              <tr key={idx} className="border-b last:border-b-0 text-sm">
                <td className="px-3 py-2 whitespace-nowrap">{fmtPermutation(cc)}</td>
                <td className="px-3 py-2 whitespace-nowrap">{conditionText}</td>
                <td className="px-3 py-2">{fmtRatio(coverage)}</td>
                {isExtended && <td className="px-3 py-2">{fmtRatio(columnRatio)}</td>}
                {isExtended && <td className="px-3 py-2">{fmtRatio(occurrenceRatio)}</td>}
                {isExtended && <td className="px-3 py-2">{fmtRatio(uniquenessRatio)}</td>}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function renderOrderDependencyTable(data: RankingResult[], isExtended: boolean) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="min-w-full bg-white rounded-md shadow-sm">
        <thead>
          <tr className="text-left text-sm text-muted border-b">
            <th className="px-3 py-2">LHS</th>
            <th className="px-3 py-2">RHS</th>
            <th className="px-3 py-2">Order Type</th>
            <th className="px-3 py-2">Comparison Operator</th>
            {isExtended && <th className="px-3 py-2">LHS Column Ratio</th>}
            {isExtended && <th className="px-3 py-2">RHS Column Ratio</th>}
            {isExtended && <th className="px-3 py-2">General Coverage</th>}
            {isExtended && <th className="px-3 py-2">LHS Occurrence Ratio</th>}
            {isExtended && <th className="px-3 py-2">RHS Occurrence Ratio</th>}
            {isExtended && <th className="px-3 py-2">LHS Uniqueness Ratio</th>}
            {isExtended && <th className="px-3 py-2">RHS Uniqueness Ratio</th>}
          </tr>
        </thead>
        <tbody>
          {data.map((r, idx) => {
            const lhs = extractRankingValue(r, ['lhs', 'LHS'])
            const rhs = extractRankingValue(r, ['rhs', 'RHS'])
            const rawOrderType = extractRankingValue(r, ['orderType', 'OrderType'])
            const rawComparison = extractRankingValue(r, ['comparisonOperator', 'ComparisonOperator'])

            const orderType = rawOrderType === 'POINTWISE' ? 'Pointwise' : rawOrderType === 'LEXICOGRAPHICAL' ? 'Lexicographical' : fmtGenericOrDash(rawOrderType)
            const comparisonOperator = rawComparison === 'SMALLER_EQUAL' ? '<=' : rawComparison === 'SMALLER' ? '<' : fmtGenericOrDash(rawComparison)

            const lhsColumnRatio = extractRankingMetric(r, 'lhsColumnRatio', 'lhs_column_ratio')
            const rhsColumnRatio = extractRankingMetric(r, 'rhsColumnRatio', 'rhs_column_ratio')
            const generalCoverage = extractRankingMetric(r, 'generalCoverage', 'coverage')
            const lhsOccurrenceRatio = extractRankingMetric(r, 'lhsOccurrenceRatio', 'lhs_occurrence_ratio')
            const rhsOccurrenceRatio = extractRankingMetric(r, 'rhsOccurrenceRatio', 'rhs_occurrence_ratio')
            const lhsUniquenessRatio = extractRankingMetric(r, 'lhsUniquenessRatio', 'lhs_uniqueness_ratio')
            const rhsUniquenessRatio = extractRankingMetric(r, 'rhsUniquenessRatio', 'rhs_uniqueness_ratio')

            return (
              <tr key={idx} className="border-b last:border-b-0 text-sm">
                <td className="px-3 py-2 whitespace-nowrap">{fmtLooseColumn(lhs)}</td>
                <td className="px-3 py-2 whitespace-nowrap">{fmtLooseColumn(rhs)}</td>
                <td className="px-3 py-2">{orderType}</td>
                <td className="px-3 py-2">{comparisonOperator}</td>
                {isExtended && <td className="px-3 py-2">{fmtRatio(lhsColumnRatio)}</td>}
                {isExtended && <td className="px-3 py-2">{fmtRatio(rhsColumnRatio)}</td>}
                {isExtended && <td className="px-3 py-2">{fmtRatio(generalCoverage)}</td>}
                {isExtended && <td className="px-3 py-2">{fmtRatio(lhsOccurrenceRatio)}</td>}
                {isExtended && <td className="px-3 py-2">{fmtRatio(rhsOccurrenceRatio)}</td>}
                {isExtended && <td className="px-3 py-2">{fmtRatio(lhsUniquenessRatio)}</td>}
                {isExtended && <td className="px-3 py-2">{fmtRatio(rhsUniquenessRatio)}</td>}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function renderMultivaluedDependencyTable(data: RankingResult[], isExtended: boolean) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="min-w-full bg-white rounded-md shadow-sm">
        <thead>
          <tr className="text-left text-sm text-muted border-b">
            <th className="px-3 py-2">Determinant</th>
            <th className="px-3 py-2">Dependant</th>
            {isExtended && <th className="px-3 py-2">Determinant Column Ratio</th>}
            {isExtended && <th className="px-3 py-2">Dependant Column Ratio</th>}
            {isExtended && <th className="px-3 py-2">Determinant Occurrence Ratio</th>}
            {isExtended && <th className="px-3 py-2">Dependant Occurrence Ratio</th>}
            <th className="px-3 py-2">General Coverage</th>
            {isExtended && <th className="px-3 py-2">Determinant Uniqueness Ratio</th>}
            {isExtended && <th className="px-3 py-2">Dependant Uniqueness Ratio</th>}
            {isExtended && <th className="px-3 py-2">Pollution</th>}
            {isExtended && <th className="px-3 py-2">Pollution Column</th>}
            {isExtended && <th className="px-3 py-2">Information Gain Cell</th>}
            {isExtended && <th className="px-3 py-2">Information Gain Byte</th>}
          </tr>
        </thead>
        <tbody>
          {data.map((r, idx) => {
            const determinant = extractRankingValue(r, ['determinant'])
            const dependant = extractRankingValue(r, ['dependant', 'dependent'])
            const determinantColumnRatio = extractRankingMetric(r, 'determinantColumnRatio', 'determinant_column_ratio')
            const dependantColumnRatio = extractRankingMetric(r, 'dependantColumnRatio', 'dependant_column_ratio')
            const determinantOccurrenceRatio = extractRankingMetric(r, 'determinantOccurrenceRatio', 'determinant_occurrence_ratio')
            const dependantOccurrenceRatio = extractRankingMetric(r, 'dependantOccurrenceRatio', 'dependant_occurrence_ratio')
            const generalCoverage = extractRankingMetric(r, 'generalCoverage', 'coverage')
            const determinantUniquenessRatio = extractRankingMetric(r, 'determinantUniquenessRatio', 'determinant_uniqueness_ratio')
            const dependantUniquenessRatio = extractRankingMetric(r, 'dependantUniquenessRatio', 'dependant_uniqueness_ratio')
            const pollution = extractRankingMetric(r, 'pollution', 'pollution')
            const pollutionColumn = extractRankingValue(r, ['pollutionColumn', 'pollution_column'])
            const informationGainCell = extractRankingMetric(r, 'informationGainCell', 'information_gain_cell')
            const informationGainByte = extractRankingMetric(r, 'informationGainByte', 'information_gain_byte')

            return (
              <tr key={idx} className="border-b last:border-b-0 text-sm">
                <td className="px-3 py-2 whitespace-nowrap">{fmtLooseColumn(determinant)}</td>
                <td className="px-3 py-2 whitespace-nowrap">{fmtLooseColumn(dependant)}</td>
                {isExtended && <td className="px-3 py-2">{fmtRatio(determinantColumnRatio)}</td>}
                {isExtended && <td className="px-3 py-2">{fmtRatio(dependantColumnRatio)}</td>}
                {isExtended && <td className="px-3 py-2">{fmtRatio(determinantOccurrenceRatio)}</td>}
                {isExtended && <td className="px-3 py-2">{fmtRatio(dependantOccurrenceRatio)}</td>}
                <td className="px-3 py-2">{fmtRatio(generalCoverage)}</td>
                {isExtended && <td className="px-3 py-2">{fmtRatio(determinantUniquenessRatio)}</td>}
                {isExtended && <td className="px-3 py-2">{fmtRatio(dependantUniquenessRatio)}</td>}
                {isExtended && <td className="px-3 py-2">{fmtGenericOrDash(pollution)}</td>}
                {isExtended && <td className="px-3 py-2 whitespace-nowrap">{fmtLooseColumn(pollutionColumn)}</td>}
                {isExtended && <td className="px-3 py-2">{fmtGenericOrDash(informationGainCell)}</td>}
                {isExtended && <td className="px-3 py-2">{fmtGenericOrDash(informationGainByte)}</td>}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function renderUniqueColumnCombinationTable(data: RankingResult[], isExtended: boolean) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="min-w-full bg-white rounded-md shadow-sm">
        <thead>
          <tr className="text-left text-sm text-muted border-b">
            <th className="px-3 py-2">Columns</th>
            {isExtended && <th className="px-3 py-2">Column Ratio</th>}
            {isExtended && <th className="px-3 py-2">Occurrence Ratio</th>}
            {isExtended && <th className="px-3 py-2">Uniqueness Ratio</th>}
            {isExtended && <th className="px-3 py-2">Randomness</th>}
          </tr>
        </thead>
        <tbody>
          {data.map((r, idx) => {
            const cc = r.columnCombination || r.result?.columnCombination
            const uniquenessRatio = extractRankingMetric(r, 'uniquenessRatio', 'uniqueness_ratio')
            const columnRatio = extractRankingMetric(r, 'columnRatio', 'column_ratio')
            const occurrenceRatio = extractRankingMetric(r, 'occurrenceRatio', 'occurrence_ratio')
            const randomness = r.randomness
            return (
              <tr key={idx} className="border-b last:border-b-0 text-sm">
                <td className="px-3 py-2 whitespace-nowrap">{fmtPermutation(cc)}</td>
                {isExtended && <td className="px-3 py-2">{fmtRatio(columnRatio)}</td>}
                {isExtended && <td className="px-3 py-2">{fmtRatio(occurrenceRatio)}</td>}
                {isExtended && <td className="px-3 py-2">{fmtRatio(uniquenessRatio)}</td>}
                {isExtended && <td className="px-3 py-2">{fmtRatio(randomness)}</td>}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function renderBasicStatisticTable(data: RankingResult[], isExtended: boolean) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="min-w-full bg-white rounded-md shadow-sm">
        <thead>
          <tr className="text-left text-sm text-muted border-b">
            <th className="px-3 py-2 whitespace-nowrap">Column(s)</th>
            <th className="px-3 py-2">Statistics</th>
            {isExtended && <th className="px-3 py-2">Column Ratio</th>}
            {isExtended && <th className="px-3 py-2">Occurrence Ratio</th>}
            {isExtended && <th className="px-3 py-2">Uniqueness Ratio</th>}
          </tr>
        </thead>
        <tbody>
          {data.map((r, idx) => {
            const combination = r.columnCombination || r.result?.columnCombination
            const stats = resolveStatisticEntries(r)
            const columnRatio = extractRankingMetric(r, 'columnRatio', 'column_ratio')
            const occurrenceRatio = extractRankingMetric(r, 'occurrenceRatio', 'occurrence_ratio')
            const uniquenessRatio = extractRankingMetric(r, 'uniquenessRatio', 'uniqueness_ratio')
            return (
              <tr key={idx} className="border-b last:border-b-0 text-sm align-top">
                <td className="px-3 py-2 whitespace-nowrap">{fmtPermutation(combination)}</td>
                <td className="px-3 py-2">
                  {stats.length > 0 ? (
                    <ul className="space-y-1">
                      {stats.map(([name, value]) => (
                        <li key={name}>
                          <span className="font-medium">{name}:</span> {value}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                {isExtended && <td className="px-3 py-2 whitespace-nowrap">{fmtRatio(columnRatio)}</td>}
                {isExtended && <td className="px-3 py-2 whitespace-nowrap">{fmtRatio(occurrenceRatio)}</td>}
                {isExtended && <td className="px-3 py-2 whitespace-nowrap">{fmtRatio(uniquenessRatio)}</td>}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function renderDenialConstraintTable(data: RankingResult[]) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="min-w-full bg-white rounded-md shadow-sm">
        <thead>
          <tr className="text-left text-sm text-muted border-b">
            <th className="px-3 py-2">Predicates</th>
            <th className="px-3 py-2 whitespace-nowrap">Size</th>
          </tr>
        </thead>
        <tbody>
          {data.map((r, idx) => {
            const dc = r.result
            const predicates = Array.isArray(dc?.predicates) ? dc.predicates : []
            return (
              <tr key={idx} className="border-b last:border-b-0 text-sm align-top">
                <td className="px-3 py-2 whitespace-pre-wrap">{formatDenialConstraintPredicates(dc)}</td>
                <td className="px-3 py-2">{predicates.length}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function renderFallback(data: RankingResult[]) {
  const preview = data.slice(0, 5)
  return (
    <div className="mt-4">
      <div className="mb-2 text-sm text-muted">
        Unsupported result type. Showing raw payload (first {preview.length} entries).
      </div>
      <pre className="bg-gray-900 text-gray-100 text-xs rounded-md p-3 overflow-auto">
        {JSON.stringify(preview, null, 2)}
      </pre>
    </div>
  )
}

function fmtPermutation(p?: ColumnPermutation | ColumnIdentifier) {
  if (!p) return '—'
  if ('columnIdentifiers' in p) {
    const perm = p as ColumnPermutation
    if (!Array.isArray(perm.columnIdentifiers)) return '—'
    return perm.columnIdentifiers
      .map((ci) => fmtColumn(ci))
      .join(', ')
  }
  return fmtColumn(p as ColumnIdentifier)
}

function fmtRatio(v?: number | null) {
  if (v == null || Number.isNaN(v)) return '—'
  const pct = Math.round(v * 1000) / 10
  return `${pct}%`
}

function fmtColumn(ci?: ColumnIdentifier) {
  if (!ci) return '—'
  const table = stripExt(ci.tableIdentifier)
  const col = ci.columnIdentifier || ''
  if (!table && !col) return '—'
  if (!table) return col
  if (!col) return table
  return `${table}.${col}`
}

function fmtLooseColumn(value: unknown) {
  if (value == null) return '—'
  if (typeof value === 'string') return value
  if (typeof value === 'object') {
    const maybePermutation = value as ColumnPermutation
    if (Array.isArray(maybePermutation.columnIdentifiers)) {
      return fmtPermutation(maybePermutation)
    }
    const maybeColumn = value as ColumnIdentifier
    if (typeof maybeColumn.columnIdentifier === 'string' || typeof maybeColumn.tableIdentifier === 'string') {
      return fmtColumn(maybeColumn)
    }
  }
  return String(value)
}

function formatMatchingIdentifier(matching: any): string {
  if (!matching || typeof matching !== 'object') return ''
  const left = matching.left ? fmtColumn(matching.left) : ''
  const right = matching.right ? fmtColumn(matching.right) : ''
  const identifier = left && right ? (left === right ? left : `${left},${right}`) : left || right
  const sim = matching.similarityMeasure
  const threshold = matching.threshold
  if (identifier && sim != null && threshold != null) {
    return `${identifier}(${sim}@${threshold})`
  }
  return identifier || ''
}

function formatCuccCondition(condition: any): string {
  if (!condition || typeof condition !== 'object') return '—'
  const ci = condition.columnIdentifier
  const left = ci && (ci.tableIdentifier || ci.columnIdentifier)
    ? fmtColumn(ci)
    : ''
  const op = condition.negated ? ' != ' : ' = '
  const right = condition.columnValue != null ? String(condition.columnValue) : ''
  const text = `${left}${op}${right}`.trim()
  return text.length > 0 ? text : '—'
}

function stripExt(name?: string) {
  if (!name) return ''
  const idx = name.lastIndexOf('.')
  return idx > 0 ? name.substring(0, idx) : name
}

function fmtPercent(v?: number | null) {
  if (v == null || Number.isNaN(v)) return '—'
  const pct = Math.round(v * 1000) / 10
  return `${pct}%`
}

function fmtGenericOrDash(v: unknown) {
  if (v == null) return '—'
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return '—'
    return fmtGenericNumber(v)
  }
  if (typeof v === 'string') {
    return v
  }
  return String(v)
}

function resolveStatisticEntries(entry: RankingResult): Array<[string, string]> {
  const statisticMap = entry.statisticMap || entry.result?.statisticMap
  if (!statisticMap || typeof statisticMap !== 'object') return []
  return Object.entries(statisticMap as Record<string, BasicStatisticValue>).map(([name, value]) => [
    name,
    fmtBasicStatisticValue(value),
  ])
}

function fmtBasicStatisticValue(value?: BasicStatisticValue | null) {
  if (!value || typeof value !== 'object') {
    return value == null ? '—' : String(value)
  }
  if (value.formattedValue && typeof value.formattedValue === 'string') {
    return value.formattedValue
  }
  if (value.value != null) {
    return fmtGenericNumber(value.value)
  }
  if ('values' in value && Array.isArray((value as any).values)) {
    return (value as any).values.join(', ')
  }
  if ('min' in value && 'max' in value) {
    return `${fmtGenericNumber((value as any).min)} – ${fmtGenericNumber((value as any).max)}`
  }
  try {
    return JSON.stringify(value)
  } catch {
    return '—'
  }
}

function fmtGenericNumber(v: unknown) {
  if (typeof v === 'number') {
    if (Number.isInteger(v)) return v.toString()
    return (Math.round(v * 1000) / 1000).toString()
  }
  return String(v)
}

function formatDenialConstraintPredicates(dc: any) {
  const predicates = Array.isArray(dc?.predicates) ? dc.predicates : []
  if (predicates.length === 0) {
    return '—'
  }

  const operatorMap: Record<string, string> = {
    EQUAL: '=',
    UNEQUAL: '≠',
    GREATER: '>',
    LESS: '<',
    GREATER_EQUAL: '≥',
    LESS_EQUAL: '≤',
  }

  const tupleLabels = new Map<number, string>()
  const formulaParts: string[] = []

  for (const predicate of predicates) {
    const op = operatorMap[predicate?.op as string] || predicate?.op || '?'
    const index1 = Number(predicate?.index1)
    const leftColumn = predicate?.column1
    const left = `t${index1}.${leftColumn?.columnIdentifier || '?'}`
    if (leftColumn?.tableIdentifier && Number.isFinite(index1)) {
      tupleLabels.set(index1, String(leftColumn.tableIdentifier))
    }

    if (predicate?.type === 'de.metanome.algorithm_integration.PredicateConstant') {
      formulaParts.push(`${left}${op}${String(predicate?.constant ?? '?')}`)
      continue
    }

    if (predicate?.type === 'de.metanome.algorithm_integration.PredicateVariable') {
      const index2 = Number(predicate?.index2)
      const rightColumn = predicate?.column2
      const right = `t${index2}.${rightColumn?.columnIdentifier || '?'}`
      if (rightColumn?.tableIdentifier && Number.isFinite(index2)) {
        tupleLabels.set(index2, String(rightColumn.tableIdentifier))
      }
      formulaParts.push(`${left}${op}${right}`)
      continue
    }

    formulaParts.push(String(predicate))
  }

  const tuplePrefix = Array.from(tupleLabels.entries())
    .sort(([a], [b]) => a - b)
    .map(([index, table]) => `t${index}∈${table}`)
    .join(',')

  return `∀${tuplePrefix}:\n¬[${formulaParts.join('∧\n ')}]`
}

function resolveBackendMessage(raw: unknown): string {
  if (typeof raw === 'string') {
    return raw
  }
  if (raw && typeof raw === 'object') {
    const message = (raw as any).message
    if (typeof message === 'string') {
      return message
    }
    const error = (raw as any).error
    if (typeof error === 'string') {
      return error
    }
    try {
      return JSON.stringify(raw)
    } catch {
      return ''
    }
  }
  return ''
}

function extractRankingMetric(
  entry: RankingResult,
  camelKey: string,
  snakeKey: string,
): number | null {
  const candidates = [
    entry?.[camelKey],
    entry?.[snakeKey],
    entry?.result?.[camelKey],
    entry?.result?.[snakeKey],
  ]

  for (const candidate of candidates) {
    if (candidate == null) continue
    if (typeof candidate === 'number') {
      return Number.isFinite(candidate) ? candidate : null
    }
    if (typeof candidate === 'string') {
      const parsed = Number(candidate)
      if (Number.isFinite(parsed)) {
        return parsed
      }
    }
  }

  return null
}

function extractRankingValue(entry: RankingResult, keys: string[]): unknown {
  const candidates: unknown[] = []

  for (const key of keys) {
    candidates.push(entry?.[key])
    candidates.push(entry?.result?.[key])
  }

  for (const candidate of candidates) {
    if (candidate != null) {
      return candidate
    }
  }

  return null
}

function shouldFallbackToDataIndependent(err?: AxiosError<any>) {
  const status = err?.response?.status
  if (status == null || status === 404) return false

  const backendText = resolveBackendMessage(err?.response?.data).toLowerCase()
  const likelyInputAccessIssue =
    backendText.includes('inputgenerationexception') ||
    backendText.includes('inputiterationexception') ||
    backendText.includes('algorithmconfigurationexception') ||
    backendText.includes('filenotfoundexception') ||
    backendText.includes('no such file') ||
    backendText.includes('permission denied')

  return likelyInputAccessIssue
}
