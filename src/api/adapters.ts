import { ProfilingResult, ColumnMetric } from './types'

// Small adapter helpers to transform backend result shapes into UI-friendly shapes.

export function normalizeHistogram(column: any): ColumnMetric['histogram'] {
  // backend may return histogram in various shapes; try to normalize common ones
  if (!column) return []
  if (Array.isArray(column)) {
    // assume array of {bucket,count} or {min,max,count}
    return column.map((b: any) => ({ bucket: b.bucket || `${b.min ?? ''}-${b.max ?? ''}`, count: b.count ?? b.c }))
  }
  // if object with buckets map
  if (typeof column === 'object') {
    return Object.keys(column).map((k) => ({ bucket: k, count: column[k] }))
  }
  return []
}

export function adaptProfilingResult(raw: any): ProfilingResult {
  // best-effort adapter. Update after backend verification.
  return {
    executionId: raw.executionId ?? raw.id ?? 0,
    rows: raw.rows ?? raw.rowCount ?? 0,
    runTimeMs: raw.runTimeMs ?? raw.durationMs ?? 0,
    anomalies: raw.anomalies ?? raw.alerts ?? [],
    columns: (raw.columns || []).map((c: any) => ({
      name: c.name,
      type: c.type,
      distinctCount: c.distinctCount ?? c.cardinality,
      missing: c.missing ?? c.nullCount,
      topValues: c.topValues ?? c.top_values ?? [],
      histogram: normalizeHistogram(c.histogram ?? c.hist)
    })),
  }
}
