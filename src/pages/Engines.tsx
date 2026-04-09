import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../api/axios'
import { endpoints } from '../api/endpoints'
import { useAvailableEngines, useRegisterEngine, useRemoveEngineWithFile } from '../api/hooks'
import { Link } from 'react-router-dom'
import { Engine } from '../api/types'

export default function Engines() {
  const { data, isLoading, isError } = useQuery<Engine[]>({
    queryKey: ['engines'],
    queryFn: async () => {
      const { data } = await api.get(endpoints.engines.list)
      return data as Engine[]
    },
  })

  const engines = useMemo(() => (Array.isArray(data) ? data : []), [data])
  const { data: available } = useAvailableEngines()
  const register = useRegisterEngine()
  const remove = useRemoveEngineWithFile()

  const registeredFiles = new Set<string>((engines || []).map((e) => e.fileName))
  const unregistered = (available || []).filter((f) => !registeredFiles.has(f))

  if (isLoading) return <div>Loading…</div>

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Engines</h1>
        <Link to="/engines/upload" className="text-sm text-white bg-primary px-3 py-1.5 rounded-md hover:opacity-90">Upload</Link>
      </div>

      {isError && (
        <div className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Could not load engines. Ensure the backend is running.
        </div>
      )}

      {(engines || []).length === 0 ? (
        <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-4">
          <div className="font-medium text-gray-800">No engines yet</div>
          <div className="mt-1 text-gray-600">Upload one or more engine JARs, then select an engine in DPQL.</div>
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {engines.map((e) => (
            <li key={e.id} className="bg-white p-3 rounded-md shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{e.name || e.fileName}</div>
                  <div className="text-xs text-muted mt-1 font-mono">{e.fileName}</div>
                  {(e.implementationTitle || e.implementationVersion) && (
                    <div className="text-xs text-muted mt-1">
                      {e.implementationTitle ? <span>{e.implementationTitle}</span> : null}
                      {e.implementationTitle && e.implementationVersion ? <span> · </span> : null}
                      {e.implementationVersion ? <span>v{e.implementationVersion}</span> : null}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="text-xs px-2 py-1 rounded-md border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-60"
                    onClick={() => {
                      if (remove.isPending) return
                      const ok = window.confirm(`Remove engine \"${e.name || e.fileName}\" and delete its JAR file from disk?`)
                      if (ok) remove.mutate(e.id)
                    }}
                    disabled={remove.isPending}
                  >
                    {remove.isPending ? 'Removing…' : 'Remove'}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8">
        <h2 className="text-lg font-medium mb-2">Available to register</h2>
        <div className="rounded-md border border-gray-200 bg-white p-3">
          {Array.isArray(available) && available.length === 0 && (
            <div className="text-sm text-muted">No engine JARs found in engines folder.</div>
          )}
          {Array.isArray(available) && available.length > 0 && unregistered.length === 0 && (
            <div className="text-sm text-muted">All discovered engine JARs are already registered.</div>
          )}
          {unregistered.length > 0 && (
            <ul className="divide-y">
              {unregistered.map((f) => (
                <li key={f} className="py-2 flex items-center justify-between">
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
          )}
          {register.isError && <div className="mt-2 text-sm text-red-700">Register failed.</div>}
        </div>
      </div>
    </div>
  )
}
