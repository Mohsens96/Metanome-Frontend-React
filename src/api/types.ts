// TypeScript types for API responses. These are best-effort shapes based on backend scan.
// Update types to match backend model classes (see backend/src/main/java/de/metanome/backend/resources/*)

export type FileInput = {
  // Backend uses Jackson polymorphic deserialization; must be provided on write.
  type?: 'fileInput'
  id: number
  name: string
  fileName?: string
  // Legacy/Metanome parsing settings (datasource settings)
  separator?: string
  quoteChar?: string
  escapeChar?: string
  skipLines?: number
  strictQuotes?: boolean
  ignoreLeadingWhiteSpace?: boolean
  hasHeader?: boolean
  skipDifferingLines?: boolean
  comment?: string
  nullValue?: string
  path?: string
  size?: number
  createdAt?: string
  columns?: Array<{ name: string; type?: string }>
}

export type Algorithm = {
  id: number
  name: string
  fileName?: string
  description?: string
}

export type Engine = {
  id: number
  fileName: string
  name?: string
  implementationTitle?: string | null
  implementationVersion?: string | null
}

export type Execution = {
  id: number
  identifier?: string
  status?: 'QUEUED' | 'RUNNING' | 'FINISHED' | 'FAILED'
  progress?: number
  startedAt?: string | null
  finishedAt?: string | null
  input?: FileInput | null
  begin?: number
  end?: number | null
  aborted?: boolean
}

export type ColumnMetric = {
  name: string
  type?: string
  distinctCount?: number
  missing?: number
  topValues?: Array<{ value: string | number; count: number }>
  histogram?: Array<{ bucket?: string; min?: number; max?: number; count: number }> // adapter will normalize
}

export type ProfilingResult = {
  executionId: number
  rows: number
  columns: ColumnMetric[]
  runTimeMs?: number
  anomalies?: Array<{ severity: 'LOW' | 'MEDIUM' | 'HIGH'; message: string; column?: string }>
}

// TODO: refine shapes to match backend DTOs exactly.

export type DpqlTable = {
  kind?: string | null
  name?: string | null
  columns?: string[]
  rows?: string[][]
  metadata?: Record<string, string> | null
}

export type DpqlResult = DpqlTable

// /dpql/results/{executionId}
export type DpqlOverviewTable = {
  tableId: number
  kind?: string | null
  name?: string | null
  columns?: string[]
}

export type DpqlOverviewResponse = {
  metadata?: Record<string, string>
  tables?: DpqlOverviewTable[]
}

// /dpql/results/{executionId}/table/{tableId}
export type DpqlTablePageResponse = {
  table?: DpqlOverviewTable
  rows?: string[][]
  offset?: number
  limit?: number
  search?: string
}

export type DpqlStoredNormalizedTable = {
  tableId: number
  kind?: string | null
  name?: string | null
  columns?: string[]
  rowCount?: number
  error?: string
}

export type DpqlRunDetailsResponse = {
  executionId: string
  createdAt?: number | null
  query?: string | null
  engineId?: number | null
  engineFileName?: string | null
  normalizedOnly?: boolean
  normalizedTables?: DpqlStoredNormalizedTable[]
}

export type DpqlRunStatus = {
  executionId: string
  status?: 'QUEUED' | 'RUNNING' | 'FINISHED' | 'FAILED' | 'CANCELED'
  createdAt?: number | null
  startedAt?: number | null
  finishedAt?: number | null
  message?: string | null
  error?: string | null
}

export type DpqlNormalizedTablePageResponse = {
  executionId: string
  tableId: number
  kind?: string | null
  name?: string | null
  columns?: string[]
  rowIds?: number[]
  rows?: string[][]
  offset: number
  limit: number
  search?: string | null
  totalRows?: number
}

// POST /dpql/expand
export type DpqlExpandRequest = {
  executionId: string

  // Can be either the AND-only predicate string or a full DPQL query; backend extracts substring after WHERE.
  where: string

  anchorKind?: string
  anchorRowId?: number
  /** Multiple anchor row IDs for multi-row selection. Takes precedence over anchorRowId if non-empty. */
  anchorRowIds?: number[]

  offset?: number
  limit?: number
}

export type DpqlExpandTuple = {
  rowIds: Record<string, number | null>
  bindings: Record<string, string | null>
  /** The anchor row ID that produced this tuple (for multi-row expansion) */
  anchorRowId?: number | null
}

export type DpqlExpandResponse = {
  variables: string[]
  tuples: DpqlExpandTuple[]
  offset: number
  limit: number
}
