import React, { useState } from 'react'
import { useAvailableEngines, useRegisterEngine, useUploadEngine } from '../api/hooks'
import { useQuery } from '@tanstack/react-query'
import api from '../api/axios'
import { endpoints } from '../api/endpoints'

export default function UploadEngine() {
  const [file, setFile] = useState<File | null>(null)
  const upload = useUploadEngine()
  const register = useRegisterEngine()
  const { data: available, refetch } = useAvailableEngines()

  // Fetch already registered engines to hide their files from register list
  const { data: registeredData } = useQuery<Array<{ id: number; fileName: string }>>({
    queryKey: ['engines'],
    queryFn: async () => {
      const { data } = await api.get(endpoints.engines.list)
      return data as Array<{ id: number; fileName: string }>
    },
  })

  const registeredFiles = new Set<string>((registeredData || []).map((e) => e.fileName))
  const unregistered = (available || []).filter((f) => !registeredFiles.has(f))

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (file) upload.mutate(file)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold mb-2">Upload Engine</h1>
        <form onSubmit={onSubmit} className="bg-white p-4 rounded-md shadow-sm space-y-3">
          <input
            type="file"
            accept=".jar"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={!file || upload.isPending}
              className="text-sm text-white bg-primary px-3 py-1.5 rounded-md disabled:opacity-60"
            >
              {upload.isPending ? 'Uploading…' : 'Upload'}
            </button>
            {upload.isError && (
              <span className="text-sm text-red-700 max-w-xl">
                Upload failed{upload.error && ': '}
                {(() => {
                  const err: any = upload.error
                  return (
                    err?.response?.data?.message ||
                    err?.response?.data?.error ||
                    err?.response?.data ||
                    (err as Error)?.message ||
                    ''
                  )
                })()}
                <ul className="mt-1 list-disc list-inside text-xs text-red-800 space-y-0.5">
                  <li>Engine JAR must provide a ServiceLoader file for ProfilingQueryEngine.</li>
                  <li>Try registering the JAR if it already exists on disk.</li>
                </ul>
              </span>
            )}
            {upload.isSuccess && <span className="text-sm text-green-700">Uploaded</span>}
          </div>
        </form>
      </div>

      <div>
        <h2 className="text-lg font-medium mb-2">Register existing JAR</h2>
        <div className="bg-white p-4 rounded-md shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => refetch()}
              className="text-sm px-3 py-1.5 rounded-md border border-gray-300 hover:bg-white"
            >
              Refresh list
            </button>
          </div>
          {Array.isArray(available) && unregistered.length > 0 ? (
            <ul className="space-y-2">
              {unregistered.map((f) => (
                <li key={f} className="py-2 border-b last:border-b-0 flex items-center justify-between">
                  <span className="font-mono text-sm">{f}</span>
                  <button
                    onClick={() => register.mutate({ fileName: f })}
                    disabled={register.isPending}
                    className="text-xs px-2 py-1 rounded-md border border-gray-300 disabled:opacity-60"
                  >
                    {register.isPending ? 'Registering…' : 'Register'}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-muted">All discovered engine JAR files are already registered.</div>
          )}
          {register.isError && <div className="mt-2 text-sm text-red-700">Register failed.</div>}
          {register.isSuccess && <div className="mt-2 text-sm text-green-700">Registered.</div>}
        </div>
      </div>
    </div>
  )
}
