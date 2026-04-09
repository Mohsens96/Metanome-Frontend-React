import React from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import api from '../api/axios'
import { endpoints } from '../api/endpoints'
import { useUpdateFileInput } from '../api/hooks'
import type { FileInput } from '../api/types'

type Preview = { headers: string[]; rows: (string | null)[][]; lineCount?: number }

export default function DatasetDetails() {
  const { id } = useParams()
  const update = useUpdateFileInput()

  const { data, isLoading } = useQuery<any>({
    queryKey: ['dataset', id],
    queryFn: async () => {
      if (!id) return null
      const { data } = await api.get(endpoints.fileInputs.get(id))
      return data
    },
    enabled: !!id,
  })

  const [form, setForm] = React.useState<Partial<FileInput> | null>(null)
  const [saveError, setSaveError] = React.useState<string | null>(null)
  const [savedPing, setSavedPing] = React.useState(false)

  React.useEffect(() => {
    if (!data) return
    // Initialize editable form from loaded dataset (keep it stable across re-renders)
    setForm((prev) => {
      if (prev && prev.id === data.id) return prev
      return {
        id: data.id,
        name: data.name,
        fileName: data.fileName,
        separator: data.separator ?? ',',
        quoteChar: data.quoteChar ?? '"',
        escapeChar: data.escapeChar ?? '\\',
        skipLines: data.skipLines ?? 0,
        strictQuotes: !!data.strictQuotes,
        ignoreLeadingWhiteSpace: data.ignoreLeadingWhiteSpace ?? true,
        hasHeader: data.hasHeader ?? true,
        skipDifferingLines: !!data.skipDifferingLines,
        nullValue: data.nullValue ?? '',
        comment: data.comment ?? '',
      } as Partial<FileInput>
    })
  }, [data])

  const { data: preview, isLoading: previewLoading, isError: previewError } = useQuery<Preview>({
    queryKey: ['datasetPreview', id],
    queryFn: async () => {
      if (!id) throw new Error('Missing id')
      const { data } = await api.get(endpoints.fileInputs.preview(id, 100))
      return data as Preview
    },
    enabled: !!id,
  })

  if (isLoading) return <div>Loading dataset…</div>
  if (!data) return <div>Not found</div>

  return (
    <div>
      <h1 className="text-xl font-semibold">{data?.name || data?.fileName || `Dataset ${id}`}</h1>

      <div className="mt-4 bg-white p-4 rounded-md shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-medium">Datasource settings</h2>
          <button
            onClick={async () => {
              if (!form?.id || update.isPending) return
              setSaveError(null)
              setSavedPing(false)

              const payload: FileInput = {
                type: 'fileInput',
                // Backend expects at least id + name; include filename/settings
                id: Number(form.id),
                name: String(form.name || data?.name || ''),
                fileName: form.fileName || data?.fileName,
                separator: form.separator ?? ',',
                quoteChar: form.quoteChar ?? '"',
                escapeChar: form.escapeChar ?? '\\',
                skipLines: Number(form.skipLines ?? 0),
                strictQuotes: !!form.strictQuotes,
                ignoreLeadingWhiteSpace: !!form.ignoreLeadingWhiteSpace,
                hasHeader: !!form.hasHeader,
                skipDifferingLines: !!form.skipDifferingLines,
                nullValue: form.nullValue ?? '',
                comment: form.comment ?? '',
              }

              // Basic validation: separator/quote/escape should be 1 char or an escape sequence like "\\t"
              const isOkChar = (v: any) => typeof v === 'string' && v.length > 0
              if (!isOkChar(payload.separator)) {
                setSaveError('Separator must not be empty.')
                return
              }
              if (!isOkChar(payload.quoteChar)) {
                setSaveError('Quote character must not be empty.')
                return
              }
              if (!isOkChar(payload.escapeChar)) {
                setSaveError('Escape character must not be empty.')
                return
              }

              try {
                await update.mutateAsync(payload)
                setSavedPing(true)
                window.setTimeout(() => setSavedPing(false), 2500)
              } catch (e: any) {
                console.error('Update dataset failed', e)
                setSaveError(e?.response?.data || 'Update failed. Please try again.')
              }
            }}
            disabled={update.isPending || !form?.id}
            className="text-sm text-white bg-primary px-3 py-1.5 rounded-md hover:opacity-90 disabled:opacity-60"
          >
            {update.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>

        {saveError && (
          <div className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{saveError}</div>
        )}
        {savedPing && (
          <div className="mt-3 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800">Saved.</div>
        )}

        {!form ? (
          <div className="text-sm text-muted mt-2">Loading settings…</div>
        ) : (
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700">Separator</label>
              <input
                value={form.separator ?? ''}
                onChange={(e) => setForm({ ...form, separator: e.target.value })}
                className="mt-1 h-9 w-full rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="; or ,"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Skip lines</label>
              <input
                type="number"
                min={0}
                value={Number(form.skipLines ?? 0)}
                onChange={(e) => setForm({ ...form, skipLines: Number(e.target.value) })}
                className="mt-1 h-9 w-full rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Quote char</label>
              <input
                value={form.quoteChar ?? ''}
                onChange={(e) => setForm({ ...form, quoteChar: e.target.value })}
                className="mt-1 h-9 w-full rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder='"'
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Escape char</label>
              <input
                value={form.escapeChar ?? ''}
                onChange={(e) => setForm({ ...form, escapeChar: e.target.value })}
                className="mt-1 h-9 w-full rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="\\"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Null value</label>
              <input
                value={form.nullValue ?? ''}
                onChange={(e) => setForm({ ...form, nullValue: e.target.value })}
                className="mt-1 h-9 w-full rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="(empty string)"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Comment</label>
              <input
                value={form.comment ?? ''}
                onChange={(e) => setForm({ ...form, comment: e.target.value })}
                className="mt-1 h-9 w-full rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            <div className="md:col-span-2 flex flex-wrap gap-4 pt-1">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!form.hasHeader}
                  onChange={(e) => setForm({ ...form, hasHeader: e.target.checked })}
                />
                Has header
              </label>
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!form.ignoreLeadingWhiteSpace}
                  onChange={(e) => setForm({ ...form, ignoreLeadingWhiteSpace: e.target.checked })}
                />
                Ignore leading whitespace
              </label>
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!form.strictQuotes}
                  onChange={(e) => setForm({ ...form, strictQuotes: e.target.checked })}
                />
                Strict quotes
              </label>
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!form.skipDifferingLines}
                  onChange={(e) => setForm({ ...form, skipDifferingLines: e.target.checked })}
                />
                Skip lines with differing length
              </label>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 bg-white p-4 rounded-md shadow-sm">
        <h2 className="font-medium">Preview</h2>
        {previewLoading && <div className="text-xs text-muted mt-2">Loading preview…</div>}
        {previewError && <div className="text-xs text-red-700 mt-2">Could not load preview. Check datasource settings (e.g., separator).</div>}
        {preview ? (
          <div className="mt-2 overflow-auto border rounded">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  {preview.headers?.map((h: string, i: number) => (
                    <th key={i} className="text-left px-2 py-1 border-b font-medium whitespace-nowrap">{h ?? ''}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows?.map((row: (string|null)[], rIdx: number) => (
                  <tr key={rIdx} className={rIdx % 2 ? 'bg-white' : 'bg-gray-50'}>
                    {row.map((cell: string | null, cIdx: number) => (
                      <td key={cIdx} className="px-2 py-1 border-b whitespace-nowrap text-gray-800">{cell ?? ''}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  )
}
