import type { DpqlExpandTuple } from '../api/types'

export type DpqlAtomOp = 'FD' | 'IND' | 'UCC' | 'MIN' | 'MAX'

export type QueryAtom = {
  op: DpqlAtomOp
  args: string[]
}

export type QueryAST = {
  variables: string[]
  atoms: QueryAtom[]
}

export type GraphNodeType = 'CC' | 'PREDICATE'

export type GraphNode = {
  id: string
  type: GraphNodeType
  label: string
  /** Full label for tooltips */
  title?: string
  /** True if selected but not present in expanded tuples */
  unmatched?: boolean

  // Optional metadata for rendering / tooltips
  op?: DpqlAtomOp
  args?: string[]
  rowId?: number
  atomIndex?: number
  ccValue?: string
}

export type GraphEdge = {
  from: string
  to: string
  type:
    | 'FD_LHS'
    | 'FD_RHS'
    | 'IND_LHS'
    | 'IND_RHS'
    | 'UCC_IN'
    | 'MIN_IN'
    | 'MAX_IN'
}

export type BuiltGraph = {
  nodes: GraphNode[]
  edges: GraphEdge[]
  truncated: boolean

  /** One highlight set per expanded tuple (same order as input). */
  tupleHighlights: Array<{ nodeIds: string[]; edgeKeys: string[] }>

  /** For unary operators (currently UCC), show as CC-attached badges. ccId -> list of predicate node ids */
  uccByCcId: Record<string, string[]>
}

const DEFAULT_LIMITS = {
  maxNodes: 2000,
  maxEdges: 2000,
} as const

function extractWhereClause(input: string): string {
  const s = input || ''
  const idx = s.toUpperCase().indexOf('WHERE')
  if (idx < 0) return s
  return s.slice(idx + 'WHERE'.length)
}

function splitTopLevelAnd(where: string): string[] {
  const s = where || ''
  const out: string[] = []
  let depth = 0
  let start = 0

  const upper = s.toUpperCase()
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (ch === '(') depth++
    else if (ch === ')') depth = Math.max(0, depth - 1)

    if (depth === 0) {
      // Match AND with word boundaries.
      if (
        upper.startsWith('AND', i) &&
        (i === 0 || /\s/.test(upper[i - 1])) &&
        (i + 3 >= upper.length || /\s/.test(upper[i + 3]))
      ) {
        const part = s.slice(start, i).trim()
        if (part) out.push(part)
        i += 2
        start = i + 1
      }
    }
  }

  const tail = s.slice(start).trim()
  if (tail) out.push(tail)
  return out
}

function parseAtom(raw: string): QueryAtom | null {
  const s = (raw || '').trim()
  const m = /^([A-Za-z_][A-Za-z0-9_]*)\s*\((.*)\)\s*$/.exec(s)
  if (!m) return null

  const op = m[1].toUpperCase() as DpqlAtomOp
  if (op !== 'FD' && op !== 'IND' && op !== 'UCC' && op !== 'MIN' && op !== 'MAX') return null

  const inner = m[2]
  const args = inner
    .split(',')
    .map((a) => a.trim())
    .filter(Boolean)

  if (args.length === 0) return null

  if ((op === 'FD' || op === 'IND') && args.length !== 2) return null
  if ((op === 'UCC' || op === 'MIN' || op === 'MAX') && args.length !== 1) return null

  return { op, args }
}

export function parseQueryAst(whereOrFullQuery: string, variablesHint?: string[]): QueryAST {
  const where = extractWhereClause(whereOrFullQuery)
  const parts = splitTopLevelAnd(where)
  const atoms: QueryAtom[] = []
  for (const p of parts) {
    const a = parseAtom(p)
    if (a) atoms.push(a)
  }

  const varSet = new Set<string>()
  for (const a of atoms) {
    for (const v of a.args) varSet.add(v)
  }

  const hinted = Array.isArray(variablesHint) ? variablesHint.filter(Boolean) : []
  const variables = hinted.length ? hinted : Array.from(varSet)

  return { variables, atoms }
}

function opToKind(op: DpqlAtomOp): string {
  // These are the normalized result kinds used by the backend.
  switch (op) {
    case 'FD':
      return 'FD_LIST'
    case 'IND':
      return 'IND_LIST'
    case 'UCC':
      return 'UCC_LIST'
    case 'MIN':
      return 'MIN_LIST'
    case 'MAX':
      return 'MAX_LIST'
  }
}

function stableHash(s: string): string {
  // Simple 32-bit FNV-1a hash encoded as hex.
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  // Convert to unsigned.
  return (h >>> 0).toString(16)
}

function canonicalizeCcValue(v: string): string {
  return (v || '').trim()
}

function shortLabel(s: string, max = 28): string {
  const t = (s || '').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max)}…`
}

function edgeTypeFor(op: DpqlAtomOp, pos: 'lhs' | 'rhs' | 'in'): GraphEdge['type'] {
  switch (op) {
    case 'FD':
      return pos === 'lhs' ? 'FD_LHS' : 'FD_RHS'
    case 'IND':
      return pos === 'lhs' ? 'IND_LHS' : 'IND_RHS'
    case 'UCC':
      return 'UCC_IN'
    case 'MIN':
      return 'MIN_IN'
    case 'MAX':
      return 'MAX_IN'
  }
}

export function buildGraph(
  query: QueryAST,
  expandedTuples: DpqlExpandTuple[],
  opts?: {
    selectedAnchorRowIds?: number[]
    anchorKind?: string | null
    maxNodes?: number
    maxEdges?: number
  }
): BuiltGraph {
  const maxNodes = Math.max(1, opts?.maxNodes ?? DEFAULT_LIMITS.maxNodes)
  const maxEdges = Math.max(1, opts?.maxEdges ?? DEFAULT_LIMITS.maxEdges)
  const selectedAnchorRowIds = (opts?.selectedAnchorRowIds || []).filter((n) => typeof n === 'number')

  // Precompute per-atom key used by backend: kind or kind_<atomIndex> when repeated.
  const kinds = query.atoms.map((a) => opToKind(a.op))
  const kindCounts = new Map<string, number>()
  for (const k of kinds) kindCounts.set(k, (kindCounts.get(k) || 0) + 1)
  const rowIdKeyByAtomIndex = kinds.map((k, i) => ((kindCounts.get(k) || 0) > 1 ? `${k}_${i}` : k))

  // Determine the anchor atom (first whose kind matches anchorKind) for unmatched selections.
  const anchorKind = (opts?.anchorKind || '').trim()
  let anchorAtomIndex = -1
  if (anchorKind) {
    for (let i = 0; i < kinds.length; i++) {
      if (kinds[i] === anchorKind) {
        anchorAtomIndex = i
        break
      }
    }
  }
  const anchorRowIdKey = anchorAtomIndex >= 0 ? rowIdKeyByAtomIndex[anchorAtomIndex] : null

  const nodesById = new Map<string, GraphNode>()
  const edgesByKey = new Map<string, GraphEdge>()
  let truncated = false

  const tupleHighlights: Array<{ nodeIds: string[]; edgeKeys: string[] }> = []
  const uccByCcId: Record<string, string[]> = {}

  const ensureNode = (n: GraphNode) => {
    if (nodesById.has(n.id)) {
      const prev = nodesById.get(n.id)!
      // Preserve unmatched=true if any caller marks it.
      if (n.unmatched && !prev.unmatched) nodesById.set(n.id, { ...prev, unmatched: true })
      return
    }
    if (nodesById.size >= maxNodes) {
      truncated = true
      return
    }
    nodesById.set(n.id, n)
  }

  const ensureEdge = (e: GraphEdge) => {
    const key = `${e.from}|${e.to}|${e.type}`
    if (edgesByKey.has(key)) return
    if (edgesByKey.size >= maxEdges) {
      truncated = true
      return
    }
    edgesByKey.set(key, e)
  }

  const ccIdForValue = (value: string) => {
    const canonical = canonicalizeCcValue(value)
    // Use hash-based ids to keep SVG stable and avoid huge DOM ids.
    return `cc:${stableHash(canonical)}`
  }

  const predicateId = (op: DpqlAtomOp, rowId: number, atomIndex: number) => {
    // op+rowId uniquely identifies the predicate row; include atomIndex only to disambiguate
    // in pathological cases where the same rowId could be reused across multiple atoms.
    return `${op.toLowerCase()}:${rowId}:${atomIndex}`
  }

  const seenAnchorIdsInTuples = new Set<number>()

  for (const t of expandedTuples || []) {
    const tupleNodeIds = new Set<string>()
    const tupleEdgeKeys: string[] = []

    const bindings = t?.bindings || {}
    const rowIds = t?.rowIds || {}

    // Create/reuse CC nodes for all bound variables in this tuple.
    const ccNodeIdByVar = new Map<string, string>()
    for (const v of query.variables) {
      const raw = bindings[v]
      if (raw == null) continue
      const canonical = canonicalizeCcValue(String(raw))
      if (!canonical) continue
      const id = ccIdForValue(canonical)
      ccNodeIdByVar.set(v, id)
      ensureNode({
        id,
        type: 'CC',
        label: shortLabel(canonical, 34),
        title: canonical,
        ccValue: canonical,
      })
      tupleNodeIds.add(id)
    }

    // Track anchor row ids that actually produce tuples.
    if (anchorRowIdKey) {
      const v = rowIds[anchorRowIdKey]
      if (typeof v === 'number') seenAnchorIdsInTuples.add(v)
    }

    // Create/reuse dependency nodes and connect according to operator semantics.
    for (let i = 0; i < query.atoms.length; i++) {
      const atom = query.atoms[i]
      const key = rowIdKeyByAtomIndex[i]
      const rid = rowIds[key]
      if (typeof rid !== 'number') continue

      const depId = predicateId(atom.op, rid, i)
      ensureNode({
        id: depId,
        type: 'PREDICATE',
        label: `${atom.op} #${rid}`,
        title: `${atom.op}(${atom.args.join(',')}) row ${rid}`,
        op: atom.op,
        args: atom.args,
        rowId: rid,
        atomIndex: i,
      })
      tupleNodeIds.add(depId)

      if (atom.op === 'FD' || atom.op === 'IND') {
        const lhsVar = atom.args[0]
        const rhsVar = atom.args[1]
        const lhsCc = ccNodeIdByVar.get(lhsVar)
        const rhsCc = ccNodeIdByVar.get(rhsVar)
        if (lhsCc) {
          const edge = { from: lhsCc, to: depId, type: edgeTypeFor(atom.op, 'lhs') } as const
          ensureEdge(edge)
          tupleEdgeKeys.push(`${edge.from}|${edge.to}|${edge.type}`)
        }
        if (rhsCc) {
          const edge = { from: depId, to: rhsCc, type: edgeTypeFor(atom.op, 'rhs') } as const
          ensureEdge(edge)
          tupleEdgeKeys.push(`${edge.from}|${edge.to}|${edge.type}`)
        }
      } else if (atom.op === 'UCC' || atom.op === 'MIN' || atom.op === 'MAX') {
        const inVar = atom.args[0]
        const inCc = ccNodeIdByVar.get(inVar)
        if (inCc) {
          const edge = { from: inCc, to: depId, type: edgeTypeFor(atom.op, 'in') } as const
          ensureEdge(edge)
          tupleEdgeKeys.push(`${edge.from}|${edge.to}|${edge.type}`)

          if (atom.op === 'UCC') {
            if (!uccByCcId[inCc]) uccByCcId[inCc] = []
            if (!uccByCcId[inCc].includes(depId)) uccByCcId[inCc].push(depId)
          }
        }
      }

      if (truncated) {
        // Stop early if we've hit caps.
        if (nodesById.size >= maxNodes || edgesByKey.size >= maxEdges) break
      }
    }

    tupleHighlights.push({
      nodeIds: Array.from(tupleNodeIds),
      edgeKeys: tupleEdgeKeys,
    })

    if (truncated && (nodesById.size >= maxNodes || edgesByKey.size >= maxEdges)) break
  }

  // Handle unmatched selections: selected anchor rows that don't appear in tuples.
  if (anchorAtomIndex >= 0 && anchorRowIdKey) {
    const op = query.atoms[anchorAtomIndex].op
    for (const rid of selectedAnchorRowIds) {
      if (seenAnchorIdsInTuples.has(rid)) continue
      const depId = predicateId(op, rid, anchorAtomIndex)
      ensureNode({
        id: depId,
        type: 'PREDICATE',
        label: `${op} #${rid}`,
        title: `Selected ${op}(${query.atoms[anchorAtomIndex].args.join(',')}) row ${rid} produced no expanded tuples on this page`,
        unmatched: true,
        op,
        args: query.atoms[anchorAtomIndex].args,
        rowId: rid,
        atomIndex: anchorAtomIndex,
      })
    }
  }

  return {
    nodes: Array.from(nodesById.values()),
    edges: Array.from(edgesByKey.values()),
    truncated,
    tupleHighlights,
    uccByCcId,
  }
}
