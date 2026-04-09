import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../api/axios'
import { endpoints } from '../api/endpoints'
import { useAlgorithmParameters, useExecution, useFileInputs, useStartExecution } from '../api/hooks'
import { toast } from '../components/Toast'

type Algo = {
  id: number
  name: string
  fileName?: string
  description?: string
  relationalInput?: boolean
  fileInput?: boolean
  tableInput?: boolean
  databaseConnection?: boolean
}

type SelectOption = {
  value: number
  label: string
  title?: string
}

export default function RunProfile(){
  const [algorithmId, setAlgorithmId] = useState<number | ''>('')
  const [fileInputId, setFileInputId] = useState<number | ''>('') // legacy single-select fallback
  const [countResults, setCountResults] = useState(true)
  const [writeResults, setWriteResults] = useState(false)
  const [cacheResults, setCacheResults] = useState(true)
  const [memoryMb, setMemoryMb] = useState<string>('')

  const { data: algorithms, isLoading: algLoading, isError: algError } = useQuery<Algo[]>({
    queryKey: ['algorithms'],
    queryFn: async () => {
      const { data } = await api.get(endpoints.algorithms.list)
      return data as Algo[]
    },
  })

  // Deduplicate algorithms for display to avoid duplicate options if backend returns duplicates
  const algoOptions: Algo[] = useMemo(() => {
    const list = algorithms || []
    const byKey = new Map<string, Algo>()
    for (const a of list) {
      const key = (a.fileName || a.name || String(a.id)).toLowerCase()
      const existing = byKey.get(key)
      // Prefer the currently selected id to keep selection stable; otherwise keep first seen
      if (!existing || a.id === algorithmId) {
        byKey.set(key, a)
      }
    }
    return Array.from(byKey.values())
  }, [algorithms, algorithmId])

  const { data: files, isLoading: filesLoading, isError: filesError } = useFileInputs()
  const start = useStartExecution()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [trackingExecution, setTrackingExecution] = useState<{ id: number; identifier?: string } | null>(null)
  const { data: trackedExecution } = useExecution(trackingExecution?.id)
  useEffect(() => {
    if (!trackingExecution || !trackedExecution) return
    if (!trackedExecution.end && !trackedExecution.aborted) return
    const label = trackedExecution.identifier || trackingExecution.identifier || `#${trackedExecution.id}`
    if (trackedExecution.aborted) {
      toast.error(`Run ${label} aborted`, { title: 'Run aborted' })
    } else {
      toast.success(`Run ${label} finished`, { title: 'Run finished' })
    }
    setTrackingExecution(null)
  }, [trackedExecution, trackingExecution])

  const selectedAlgo = useMemo(() => (algorithms || []).find(a => a.id === algorithmId), [algorithms, algorithmId])
  const canRunWithFile = selectedAlgo?.fileInput || selectedAlgo?.relationalInput || true // best effort

  // Load algorithm parameter requirements for dynamic form
  const algoFileName = selectedAlgo?.fileName
  const { data: requirements, isLoading: reqLoading } = useAlgorithmParameters(algoFileName)

  // For relational/file input requirements, store selected dataset IDs (per requirement idx)
  const [relationalSelections, setRelationalSelections] = useState<Record<number, Array<number | ''>>>({})

  // User-entered primitive settings: map of requirement index -> array of values (strings)
  const [primitiveValues, setPrimitiveValues] = useState<Record<number, string[]>>({})

  // Reset primitive values when algorithm changes
  useEffect(() => {
    setPrimitiveValues({})
  }, [algoFileName])

  // Initialize relational selection rows to minimum counts when requirements load
  useEffect(() => {
    if (!Array.isArray(requirements)) return
    const next: Record<number, Array<number | ''>> = {}
    requirements.forEach((r: any, idx: number) => {
      if (r.type === 'ConfigurationRequirementRelationalInput' || r.type === 'ConfigurationRequirementFileInput') {
        const isFixed = r.minNumberOfSettings === r.maxNumberOfSettings && r.maxNumberOfSettings > 0
        const initialCount = isFixed ? r.maxNumberOfSettings : (r.minNumberOfSettings > 0 ? r.minNumberOfSettings : 1)
        next[idx] = Array.from({ length: initialCount }, () => '')
      }
    })
    setRelationalSelections(next)
  }, [requirements])

  const setRelationalSelection = (reqIndex: number, pos: number, value: number | '') => {
    setRelationalSelections((prev) => {
      const arr = prev[reqIndex] ? [...prev[reqIndex]] : []
      arr[pos] = value
      return { ...prev, [reqIndex]: arr }
    })
  }

  // Deduplicate dataset options to avoid duplicate entries if backend returns duplicates
  const fileOptions = useMemo(() => {
    const list = files || []
    const selectedIds = new Set<number>()
    if (typeof fileInputId === 'number') selectedIds.add(fileInputId)
    Object.values(relationalSelections).forEach((arr) => {
      (arr || []).forEach((v) => { if (typeof v === 'number') selectedIds.add(v) })
    })
    const byLabel = new Map<string, any>()
    for (const f of list) {
      const label = String(f.name || f.fileName || f.id).toLowerCase()
      const existing = byLabel.get(label)
      if (!existing) {
        byLabel.set(label, f)
      } else if (selectedIds.has(f.id) && !selectedIds.has(existing.id)) {
        // Prefer currently selected id when labels collide
        byLabel.set(label, f)
      }
    }
    return Array.from(byLabel.values())
  }, [files, fileInputId, relationalSelections])

  const formatDatasetLabel = (f: any) => {
    const raw = (f && (f.fileName || f.name)) ? String(f.fileName || f.name) : ''
    const parts = raw.split(/[/\\]/g)
    const leaf = parts[parts.length - 1] || raw
    return leaf || raw || `Dataset ${f?.id ?? ''}`
  }

  const algorithmSelectOptions = useMemo<SelectOption[]>(() => {
    return (algoOptions || []).map((a) => {
      const label = [a.name, a.fileName].filter(Boolean).join(' — ')
      return {
        value: a.id,
        label,
        title: label,
      }
    })
  }, [algoOptions])

  const datasetSelectOptions = useMemo<SelectOption[]>(() => {
    return (fileOptions || []).map((f: any) => {
      const label = formatDatasetLabel(f)
      const full = String(f.fileName || f.name || '')
      return {
        value: f.id,
        label,
        title: full,
      }
    })
  }, [fileOptions])

  const addRelationalRow = (reqIndex: number, max: number) => {
    setRelationalSelections((prev) => {
      const arr = prev[reqIndex] ? [...prev[reqIndex]] : []
      if (arr.length < (max > 0 ? max : arr.length + 1)) arr.push('')
      return { ...prev, [reqIndex]: arr }
    })
  }

  // Validate: if relational requirements exist, ensure min selections and all filled
  const hasRelationalReqs = Array.isArray(requirements) && requirements.some((r: any) => r.type === 'ConfigurationRequirementRelationalInput' || r.type === 'ConfigurationRequirementFileInput')
  const formValid = useMemo(() => {
    if (!algorithmId) return false
    if (hasRelationalReqs) {
      for (let idx = 0; idx < (requirements?.length || 0); idx++) {
        const r: any = (requirements as any[])[idx]
        if (!(r && (r.type === 'ConfigurationRequirementRelationalInput' || r.type === 'ConfigurationRequirementFileInput'))) continue
        const min = r?.minNumberOfSettings || 1
        const arr = relationalSelections[idx] || []
        const filled = arr.filter((x) => typeof x === 'number')
        if (filled.length < min) return false
      }
      return true
    } else {
      return !!fileInputId
    }
  }, [algorithmId, hasRelationalReqs, requirements, relationalSelections, fileInputId])

  const removeRelationalRow = (reqIndex: number, min: number, at: number) => {
    setRelationalSelections((prev) => {
      const arr = prev[reqIndex] ? [...prev[reqIndex]] : []
      if (arr.length > (min > 0 ? min : 1)) {
        arr.splice(at, 1)
      }
      return { ...prev, [reqIndex]: arr }
    })
  }

  const updatePrimitiveValue = (reqIndex: number, pos: number, value: string) => {
    setPrimitiveValues((prev) => {
      const arr = prev[reqIndex] ? [...prev[reqIndex]] : []
      arr[pos] = value
      return { ...prev, [reqIndex]: arr }
    })
  }

  const onStart = async (e: React.FormEvent) => {
    e.preventDefault()
  if (!algorithmId) return

    const execIdentifier = `${selectedAlgo?.fileName || selectedAlgo?.name || 'algo'}_${new Date().toISOString().replace(/[-:TZ.]/g, '')}`

    // Build requirements payload: start from backend-provided requirements when available
    const reqs: any[] = []
  const backendReqs: any[] = Array.isArray(requirements) ? requirements : []

    if (backendReqs.length > 0) {
      for (let idx = 0; idx < backendReqs.length; idx++) {
        const r = backendReqs[idx]
        const base = {
          type: r.type,
          identifier: r.identifier,
          required: r.required,
          numberOfSettings: r.numberOfSettings,
          minNumberOfSettings: r.minNumberOfSettings,
          maxNumberOfSettings: r.maxNumberOfSettings,
        }
        // File/relational input: map to selected file
        if (r.type === 'ConfigurationRequirementRelationalInput' || r.type === 'ConfigurationRequirementFileInput') {
          const selectedIds = relationalSelections[idx]
          let idsToUse: Array<number> = []
          if (selectedIds && selectedIds.length) {
            idsToUse = selectedIds.filter((x): x is number => typeof x === 'number')
          } else if (fileInputId) {
            idsToUse = [Number(fileInputId)]
          }
          // Fetch details for each id
          const files = await Promise.all(
            idsToUse.map(async (fid) => {
              const { data } = await api.get(endpoints.fileInputs.get(fid))
              return data
            })
          )
          const settings = files.map((f: any) => ({
            type: 'ConfigurationSettingFileInput',
            id: f.id,
            fileName: f.fileName || f.name,
            advanced: false,
            separatorChar: f.separator ?? ',',
            quoteChar: f.quoteChar ?? '"',
            escapeChar: f.escapeChar ?? '\\',
            strictQuotes: !!f.strictQuotes,
            ignoreLeadingWhiteSpace: (f.ignoreLeadingWhiteSpace ?? true) as boolean,
            skipLines: f.skipLines ?? 0,
            header: !!(f.hasHeader ?? true),
            skipDifferingLines: !!f.skipDifferingLines,
            nullValue: f.nullValue ?? ''
          }))
          reqs.push({ ...base, settings })
          continue
        }
        // Primitive requirements
        if (r.type === 'ConfigurationRequirementInteger' || r.type === 'ConfigurationRequirementString' || r.type === 'ConfigurationRequirementBoolean') {
          const valuesFromForm = primitiveValues[idx]
          const defaults: any[] = Array.isArray(r.defaultValues) ? r.defaultValues : []
          const values = valuesFromForm && valuesFromForm.length > 0 ? valuesFromForm : defaults
          const settings = (values || []).filter((v) => v !== undefined && v !== null && String(v).length > 0).map((v) => {
            if (r.type === 'ConfigurationRequirementInteger') {
              return { type: 'ConfigurationSettingInteger', value: Number(v) }
            }
            if (r.type === 'ConfigurationRequirementBoolean') {
              const bv = typeof v === 'boolean' ? v : String(v).toLowerCase() === 'true'
              return { type: 'ConfigurationSettingBoolean', value: bv }
            }
            return { type: 'ConfigurationSettingString', value: String(v) }
          })
          reqs.push({ ...base, settings })
          continue
        }
        // Unknown requirement types -> send empty settings to skip
        reqs.push({ ...base, settings: [] })
      }
    } else {
      // Fallback: single relational input requirement with legacy single dataset selector
      if (!fileInputId) {
        setErrorMsg('Please select a dataset')
        return
      }
      const { data: file } = await api.get(endpoints.fileInputs.get(fileInputId))
      reqs.push({
        type: 'ConfigurationRequirementRelationalInput',
        identifier: 'Relational Input',
        required: true,
        numberOfSettings: 1,
        minNumberOfSettings: 1,
        maxNumberOfSettings: 1,
        settings: [
          {
            type: 'ConfigurationSettingFileInput',
            id: file.id,
            fileName: file.fileName || file.name,
            advanced: false,
            separatorChar: file.separator ?? ',',
            quoteChar: file.quoteChar ?? '"',
            escapeChar: file.escapeChar ?? '\\',
            strictQuotes: !!file.strictQuotes,
            ignoreLeadingWhiteSpace: (file.ignoreLeadingWhiteSpace ?? true) as boolean,
            skipLines: file.skipLines ?? 0,
            header: !!(file.hasHeader ?? true),
            skipDifferingLines: !!file.skipDifferingLines,
            nullValue: file.nullValue ?? ''
          }
        ]
      })
    }

    const payload = {
      algorithmId,
      executionIdentifier: execIdentifier,
      requirements: reqs,
      cacheResults,
      writeResults,
      countResults,
      memory: memoryMb || ''
    }
    setErrorMsg(null)
    try {
      // Helpful debug: log the outgoing payload
      console.debug('Start execution payload', payload)
      const execution = await start.mutateAsync(payload as any)
      const label = execution?.identifier || execIdentifier || `#${execution?.id}`
      toast.info(`Run ${label} started`, { title: 'Run started' })
      if (execution?.id) {
        setTrackingExecution({ id: execution.id, identifier: execution?.identifier || execIdentifier })
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.response?.data || e?.message || 'Start failed'
      toast.error(String(msg), { title: 'Run failed' })
      setErrorMsg(String(msg))
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Start Profiling</h1>
        <p className="text-sm text-muted">Choose algorithm and dataset, then start a run</p>
      </div>

  <form onSubmit={onStart} className="bg-white p-4 rounded-md shadow-sm space-y-4 max-w-3xl">
        <div>
          <label className="block text-sm font-medium mb-1">Algorithm</label>
          <SearchableSelect
            placeholder="Select an algorithm…"
            options={algorithmSelectOptions}
            value={typeof algorithmId === 'number' ? algorithmId : ''}
            onChange={setAlgorithmId}
          />
          {algLoading && <div className="text-xs text-muted mt-1">Loading algorithms…</div>}
          {algError && <div className="text-xs text-red-700 mt-1">Failed to load algorithms</div>}
        </div>

        {/* Datasets selection: if backend requirements define relational/file inputs, render per-requirement selectors. Else show legacy single selector. */}
        {Array.isArray(requirements) && requirements.some((r: any) => r.type === 'ConfigurationRequirementRelationalInput' || r.type === 'ConfigurationRequirementFileInput') ? (
          <div>
            <div className="block text-sm font-medium mb-2">Datasets</div>
            {requirements.map((r: any, idx: number) => {
              if (!(r.type === 'ConfigurationRequirementRelationalInput' || r.type === 'ConfigurationRequirementFileInput')) return null
              const selections = relationalSelections[idx] || []
              const isFixed = r.minNumberOfSettings === r.maxNumberOfSettings && r.maxNumberOfSettings > 0
              const max = r.maxNumberOfSettings || selections.length || 1
              const min = r.minNumberOfSettings || 1
              const label = r.identifier || 'Relational Input'
              return (
                <div key={idx} className="mb-3 p-2 border rounded-md">
                  <div className="text-sm font-medium mb-2">{label} {isFixed ? `(select ${min})` : `(min ${min}${max > 0 ? `, max ${max}` : ''})`}</div>
                  <div className="space-y-2">
                    {selections.map((sel, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="w-full">
                          <SearchableSelect
                            placeholder="Select a dataset…"
                            options={datasetSelectOptions}
                            value={typeof sel === 'number' ? sel : ''}
                            onChange={(next) => setRelationalSelection(idx, i, next)}
                          />
                        </div>
                        {!isFixed && selections.length > min && (
                          <button type="button" className="text-xs px-2 py-1 rounded-md border" onClick={() => removeRelationalRow(idx, min, i)}>Remove</button>
                        )}
                      </div>
                    ))}
                  </div>
                  {!isFixed && (max <= 0 || selections.length < max) && (
                    <div className="mt-2">
                      <button type="button" className="text-xs px-2 py-1 rounded-md border" onClick={() => addRelationalRow(idx, max)}>Add dataset</button>
                    </div>
                  )}
                </div>
              )
            })}
            {filesLoading && <div className="text-xs text-muted mt-1">Loading datasets…</div>}
            {filesError && <div className="text-xs text-red-700 mt-1">Failed to load datasets</div>}
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium mb-1">Dataset (file input)</label>
            <SearchableSelect
              placeholder="Select a dataset…"
              options={datasetSelectOptions}
              value={typeof fileInputId === 'number' ? fileInputId : ''}
              onChange={setFileInputId}
            />
            {filesLoading && <div className="text-xs text-muted mt-1">Loading datasets…</div>}
            {filesError && <div className="text-xs text-red-700 mt-1">Failed to load datasets</div>}
          </div>
        )}

        <div className="flex items-center gap-6 text-sm">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={countResults} onChange={(e) => setCountResults(e.target.checked)} />
            Count results
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={writeResults} onChange={(e) => setWriteResults(e.target.checked)} />
            Write results
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={cacheResults} onChange={(e) => setCacheResults(e.target.checked)} />
            Cache results
          </label>
          <label className="inline-flex items-center gap-2">
            <span>Memory (MB)</span>
            <input
              type="number"
              className="w-24 border rounded px-2 py-1"
              placeholder=""
              value={memoryMb}
              onChange={(e) => setMemoryMb(e.target.value)}
              min={0}
            />
          </label>
        </div>

        {!canRunWithFile && (
          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
            Selected algorithm might not accept file inputs.
          </div>
        )}

        {/* Dynamic primitive parameter inputs */}
        {algoFileName && (
          <div className="border-t pt-3">
            <div className="font-medium mb-2 text-sm">Algorithm parameters</div>
            {reqLoading && <div className="text-xs text-muted">Loading parameters…</div>}
            {Array.isArray(requirements) && requirements
              .map((r: any, idx: number) => ({ r, idx }))
              .filter(({ r }) => ['ConfigurationRequirementInteger', 'ConfigurationRequirementString', 'ConfigurationRequirementBoolean'].includes(r.type))
              .map(({ r, idx }) => {
                const count = (r.numberOfSettings && r.numberOfSettings > 0)
                  ? r.numberOfSettings
                  : (r.maxNumberOfSettings && r.maxNumberOfSettings > 0)
                    ? r.maxNumberOfSettings
                    : 1
                const label = r.identifier || r.type
                const values = primitiveValues[idx] || []
                const placeholders = Array.from({ length: count })
                return (
                  <div key={idx} className="mb-3">
                    <div className="text-xs text-muted mb-1">{label}{r.required ? ' *' : ''}</div>
                    <div className="flex flex-wrap gap-2">
                      {placeholders.map((_, i) => (
                        <ParamInput
                          key={i}
                          type={r.type}
                          value={values[i] ?? ''}
                          onChange={(val) => updatePrimitiveValue(idx, i, val)}
                        />
                      ))}
                    </div>
                    {Array.isArray(r.defaultValues) && r.defaultValues.length > 0 && (
                      <div className="text-[11px] text-muted mt-1">Defaults: {r.defaultValues.join(', ')}</div>
                    )}
                  </div>
                )
              })}
            {Array.isArray(requirements) && requirements.every((p: any) => !['ConfigurationRequirementInteger', 'ConfigurationRequirementString', 'ConfigurationRequirementBoolean'].includes(p.type)) && (
              <div className="text-xs text-muted">No extra parameters required.</div>
            )}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={!formValid || start.isPending}
            className="text-sm text-white bg-primary px-3 py-1.5 rounded-md disabled:opacity-60"
          >
            {start.isPending ? 'Starting…' : 'Start run'}
          </button>
          {errorMsg && (
            <pre className="text-sm text-red-700 break-all whitespace-pre-wrap max-w-3xl">
              {errorMsg}
            </pre>
          )}
          {start.isSuccess && <span className="text-sm text-green-700">Run started (id: {(start.data as any)?.id})</span>}
        </div>
      </form>

      <div className="text-sm text-muted">
        Tip: Upload datasets on the Upload page, register algorithms on the Algorithms page, then start a run here.
      </div>
    </div>
  )
}

type ParamInputProps = {
  type: 'ConfigurationRequirementInteger' | 'ConfigurationRequirementString' | 'ConfigurationRequirementBoolean'
  value: string
  onChange: (v: string) => void
}

function ParamInput({ type, value, onChange }: ParamInputProps) {
  if (type === 'ConfigurationRequirementBoolean') {
    const checked = String(value).toLowerCase() === 'true'
    return (
      <label className="inline-flex items-center gap-2 text-sm">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(String(e.target.checked))} />
        <span>True?</span>
      </label>
    )
  }
  return (
    <input
      className="border rounded px-2 py-1 text-sm"
      type={type === 'ConfigurationRequirementInteger' ? 'number' : 'text'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

type SearchableSelectProps = {
  options: SelectOption[]
  value: number | ''
  onChange: (value: number | '') => void
  placeholder: string
}

function SearchableSelect({ options, value, onChange, placeholder }: SearchableSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const wrapperRef = useRef<HTMLDivElement | null>(null)

  const selectedOption = useMemo(() => {
    if (value === '') return null
    return options.find((o) => o.value === value) || null
  }, [options, value])

  useEffect(() => {
    setQuery(selectedOption?.label || '')
  }, [selectedOption?.label])

  useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
      if (!wrapperRef.current) return
      if (!wrapperRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return options
    return options.filter((o) => {
      const haystack = `${o.label} ${o.title || ''}`.toLowerCase()
      return haystack.includes(normalized)
    })
  }, [options, query])

  const applySelection = (option: SelectOption) => {
    onChange(option.value)
    setQuery(option.label)
    setOpen(false)
  }

  return (
    <div className="relative" ref={wrapperRef}>
      <input
        type="text"
        className="w-full border border-gray-300 rounded px-2 py-1 bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
        placeholder={placeholder}
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          const next = e.target.value
          setQuery(next)
          setOpen(true)
          if (next.trim() === '') {
            onChange('')
          }
        }}
      />
      {open && (
        <div className="absolute z-20 mt-1 w-full max-h-56 overflow-auto rounded border border-gray-300 bg-white shadow-sm">
          {filtered.length === 0 ? (
            <div className="px-2 py-1 text-sm text-muted">No matches</div>
          ) : (
            filtered.map((option) => (
              <button
                key={option.value}
                type="button"
                title={option.title || option.label}
                onClick={() => applySelection(option)}
                className="w-full text-left px-2 py-1 text-sm hover:bg-gray-50"
              >
                {option.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
