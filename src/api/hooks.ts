import { useQuery, useMutation, UseMutationResult, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import api from './axios'
import { endpoints } from './endpoints'
import { FileInput, Execution, ProfilingResult, DpqlResult, Engine, DpqlOverviewResponse, DpqlTablePageResponse, DpqlNormalizedTablePageResponse, DpqlRunStatus, DpqlExpandRequest, DpqlExpandResponse } from './types'
import { adaptProfilingResult } from './adapters'

export function useFileInputs() {
  return useQuery<FileInput[]>({
    queryKey: ['fileInputs'],
    queryFn: async () => {
      const { data } = await api.get(endpoints.fileInputs.list)
      return data as FileInput[]
    },
  })
}

export function useUploadFile(): UseMutationResult<any, any, FormData> {
  const qc = useQueryClient()
  return useMutation<any, any, FormData>({
    mutationFn: async (formData: FormData) => {
      // Allow axios/browser to set proper multipart Content-Type with boundary
      const { data } = await api.post(endpoints.fileInputs.storeMultipart, formData, {
        onUploadProgress: (e) => {
          console.debug('upload progress', Math.round((e.loaded / (e.total || 1)) * 100))
        },
      })
      return data
    },
    onSuccess: (data) => {
      const items: any[] = Array.isArray(data) ? data : (data && typeof data === 'object' ? [data] : [])
      if (items.length > 0) {
        // Optimistically merge newly uploaded datasets into the list if available
        qc.setQueryData<any>(['fileInputs'], (prev: any) => {
          if (!Array.isArray(prev)) return prev
          const merged = [...prev]
          for (const item of items) {
            const id = item?.id as number | undefined
            if (id != null && merged.some((d: any) => d?.id === id)) {
              continue
            }
            merged.push(item)
          }
          return merged
        })
      }
      // Always invalidate to ensure consistency with server
      qc.invalidateQueries({ queryKey: ['fileInputs'] })
    },
  })
}

// Convenience: upload a tiny generated CSV so the datasets list isn't empty during testing
export function useUploadSampleDataset(fileName = 'sample-customers.csv') {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const csv = [
        'Name,Age,City',
        'Alice,30,Berlin',
        'Bob,25,Hamburg',
        'Clara,40,Munich',
      ].join('\n')

      const blob = new Blob([csv], { type: 'text/csv' })
      const fd = new FormData()
      fd.append('file', blob, fileName)
      const { data } = await api.post(endpoints.fileInputs.storeMultipart, fd)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fileInputs'] })
    },
  })
}

export function useStartExecution() {
  const qc = useQueryClient()
  return useMutation<Execution, any, any>({
    mutationFn: async (payload: any) => {
      const { data } = await api.post(endpoints.algorithmExecution.start, payload)
      return data as Execution
    },
    onSuccess: (execution) => {
      qc.invalidateQueries({ queryKey: ['executions'] })
      if (execution?.id) {
        qc.invalidateQueries({ queryKey: ['execution', execution.id] })
      }
    },
  })
}

export function useExecution(id?: string | number) {
  return useQuery<Execution>({
    queryKey: ['execution', id],
    queryFn: async () => {
      if (!id) throw new Error('Missing id')
      const { data } = await api.get(endpoints.executions.get(id))
      return data as Execution
    },
    enabled: !!id,
    refetchInterval: 2000,
  })
}

// Delete an execution (run) by id
export function useDeleteExecution() {
  const qc = useQueryClient()
  return useMutation<void, any, number>({
    mutationFn: async (id: number) => {
      await api.delete(endpoints.executions.delete(id))
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['executions'] })
      qc.invalidateQueries({ queryKey: ['executionResultsCount'] })
    },
  })
}

export function useDeleteAllExecutions() {
  const qc = useQueryClient()
  return useMutation<{ executionsDeleted: number; filesDeleted: number }, any, void>({
    mutationFn: async () => {
      const { data } = await api.delete(endpoints.executions.deleteAll)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['executions'] })
      qc.invalidateQueries({ queryKey: ['executionResultsCount'] })
    },
  })
}

// Fetch available input files on disk (not yet in DB)
export function useAvailableInputFiles() {
  return useQuery<string[]>({
    queryKey: ['availableInputFiles'],
    queryFn: async () => {
      const { data } = await api.get(endpoints.fileInputs.available)
      return data as string[]
    },
  })
}

// Import a list of available file paths into the DB
export function useImportAvailableInputFiles() {
  const qc = useQueryClient()
  return useMutation<{ success: number; failed: number }, any, string[] | undefined>({
    mutationFn: async (paths?: string[]) => {
      let toImport = paths
      if (!toImport) {
        const { data } = await api.get(endpoints.fileInputs.available)
        toImport = data as string[]
      }
      const results = await Promise.allSettled(
        (toImport || []).map((p) => {
          const name = p.split(/[/\\]/).pop() || p
          return api.post(endpoints.fileInputs.storeJson, { fileName: p, name })
        })
      )
      const success = results.filter((r) => r.status === 'fulfilled').length
      const failed = results.length - success
      return { success, failed }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fileInputs'] })
    },
  })
}

// Delete a dataset (file input) by id
export function useDeleteFileInput() {
  const qc = useQueryClient()
  return useMutation<void, any, number>({
    mutationFn: async (id: number) => {
      await api.delete(endpoints.fileInputs.delete(id))
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fileInputs'] })
    },
  })
}

// Update a dataset (file input) settings
export function useUpdateFileInput() {
  const qc = useQueryClient()
  return useMutation<FileInput, any, FileInput>({
    mutationFn: async (payload: FileInput) => {
      const { data } = await api.post(endpoints.fileInputs.update, payload)
      return data as FileInput
    },
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['fileInputs'] })
      if (updated?.id != null) {
        qc.invalidateQueries({ queryKey: ['dataset', String(updated.id)] })
        qc.invalidateQueries({ queryKey: ['datasetPreview', String(updated.id)] })
        qc.invalidateQueries({ queryKey: ['datasetPreviewCount', updated.id] })
      }
    },
  })
}

export function useProfilingResult(id?: string | number) {
  return useQuery<ProfilingResult>({
    queryKey: ['profilingResult', id],
    queryFn: async () => {
      if (!id) throw new Error('Missing id')
      const { data } = await api.get(endpoints.resultStore.loadResults(id))
      return adaptProfilingResult(data)
    },
    enabled: !!id,
  })
}

// Algorithms: list available JARs on disk (not yet in DB)
export function useAvailableAlgorithms() {
  return useQuery<string[]>({
    queryKey: ['availableAlgorithms'],
    queryFn: async () => {
      const { data } = await api.get(endpoints.algorithms.availableFiles)
      return data as string[]
    },
  })
}

// Engines: list available engine JARs on disk (not yet in DB)
export function useAvailableEngines() {
  return useQuery<string[]>({
    queryKey: ['availableEngines'],
    queryFn: async () => {
      const { data } = await api.get(endpoints.engines.availableFiles)
      return data as string[]
    },
  })
}

// Upload an engine JAR via multipart
export function useUploadEngine() {
  const qc = useQueryClient()
  return useMutation<any, any, File>({
    mutationFn: async (file: File) => {
      const fd = new FormData()
      fd.append('file', file, file.name)
      const { data } = await api.post(endpoints.engines.storeMultipart, fd)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['engines'] })
      qc.invalidateQueries({ queryKey: ['availableEngines'] })
    },
  })
}

// Register an existing engine JAR already present on disk
export function useRegisterEngine() {
  const qc = useQueryClient()
  return useMutation<any, any, { fileName: string } | string>({
    mutationFn: async (payload) => {
      const body = typeof payload === 'string' ? { fileName: payload } : payload
      const { data } = await api.post(endpoints.engines.storeJson, body)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['engines'] })
      qc.invalidateQueries({ queryKey: ['availableEngines'] })
    },
  })
}

// Delete/deregister an engine by id
export function useDeleteEngine() {
  const qc = useQueryClient()
  return useMutation<void, any, number>({
    mutationFn: async (id: number) => {
      await api.delete(endpoints.engines.delete(id))
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['engines'] })
      qc.invalidateQueries({ queryKey: ['availableEngines'] })
    },
  })
}

// Remove an engine and delete its physical JAR file
export function useRemoveEngineWithFile() {
  const qc = useQueryClient()
  return useMutation<{ id: number; fileName?: string; fileDeleted: boolean }, any, number>({
    mutationFn: async (id: number) => {
      const { data } = await api.delete(endpoints.engines.removeWithFile(id))
      return data as { id: number; fileName?: string; fileDeleted: boolean }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['engines'] })
      qc.invalidateQueries({ queryKey: ['availableEngines'] })
    },
  })
}

// Import available algorithm files into DB
export function useImportAvailableAlgorithms() {
  const qc = useQueryClient()
  return useMutation<{ success: number; failed: number; details: Array<{ file: string; ok: boolean; error?: string }> }, any, string[] | undefined>({
    mutationFn: async (files?: string[]) => {
      let toImport = files
      if (!toImport) {
        const { data } = await api.get(endpoints.algorithms.availableFiles)
        toImport = data as string[]
      }
      const results = await Promise.allSettled(
        (toImport || []).map(async (f) => {
          try {
            await api.post(endpoints.algorithms.storeJson, { fileName: f })
            return { file: f, ok: true as const }
          } catch (e: any) {
            return { file: f, ok: false as const, error: e?.response?.data?.message || e?.message || 'Import failed' }
          }
        })
      )
      const details = results.map((r) => (r.status === 'fulfilled' ? r.value : { file: 'unknown', ok: false as const, error: 'Unknown error' }))
      const success = details.filter((d) => d.ok).length
      const failed = details.length - success
      return { success, failed, details }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['algorithms'] })
    },
  })
}

// Upload an algorithm JAR via multipart
export function useUploadAlgorithm() {
  const qc = useQueryClient()
  return useMutation<any, any, File>({
    mutationFn: async (file: File) => {
      const fd = new FormData()
      fd.append('file', file, file.name)
      // Don't manually set Content-Type; let browser add multipart boundary
      const { data } = await api.post(endpoints.algorithms.storeMultipart, fd)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['availableAlgorithms'] })
      qc.invalidateQueries({ queryKey: ['algorithms'] })
    },
  })
}

// Register an existing algorithm JAR already present on disk
export function useRegisterAlgorithm() {
  const qc = useQueryClient()
  return useMutation<any, any, { fileName: string; name?: string } | string>({
    mutationFn: async (payload) => {
      const body = typeof payload === 'string' ? { fileName: payload } : payload
      const { data } = await api.post(endpoints.algorithms.storeJson, body)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['availableAlgorithms'] })
      qc.invalidateQueries({ queryKey: ['algorithms'] })
    },
  })
}

// Preview authors/description for a given algorithm file
export function useAlgorithmAuthorsDescription(fileName?: string) {
  return useQuery<{ authors?: string; description?: string }>({
    queryKey: ['algoAuthorsDesc', fileName],
    queryFn: async () => {
      if (!fileName) throw new Error('Missing fileName')
      const { data } = await api.get(endpoints.parameters.authorsDescription(fileName))
      return data as { authors?: string; description?: string }
    },
    enabled: !!fileName,
  })
}

// Fetch algorithm configuration requirements for a given algorithm file (JAR name)
export function useAlgorithmParameters(fileName?: string) {
  return useQuery<any[]>({
    queryKey: ['algoParams', fileName],
    queryFn: async () => {
      if (!fileName) throw new Error('Missing fileName')
      const { data } = await api.get(endpoints.parameters.getForAlgorithm(fileName))
      return data as any[]
    },
    enabled: !!fileName,
  })
}

// Delete/deregister an algorithm by id
export function useDeleteAlgorithm() {
  const qc = useQueryClient()
  return useMutation<void, any, number>({
    mutationFn: async (id: number) => {
      await api.delete(endpoints.algorithms.delete(id))
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['algorithms'] })
      qc.invalidateQueries({ queryKey: ['availableAlgorithms'] })
    },
  })
}

// Remove an algorithm and delete its physical JAR file
export function useRemoveAlgorithmWithFile() {
  const qc = useQueryClient()
  return useMutation<{ id: number; fileName?: string; fileDeleted: boolean }, any, number>({
    mutationFn: async (id: number) => {
      const { data } = await api.delete(endpoints.algorithms.removeWithFile(id))
      return data as { id: number; fileName?: string; fileDeleted: boolean }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['algorithms'] })
      // Optimistically update availableAlgorithms to remove the deleted file immediately
      qc.setQueryData<string[] | undefined>(['availableAlgorithms'], (prev) => {
        if (!prev) return prev
        // We don't have fileName here unless we pass it; keep simple invalidate fallback as well
        return prev
      })
      qc.invalidateQueries({ queryKey: ['availableAlgorithms'] })
    },
  })
}

// Bulk remove all algorithms and their files
export function useBulkRemoveAlgorithms() {
  const qc = useQueryClient()
  return useMutation<{ algorithmsProcessed: number; filesDeleted: number }, any, void>({
    mutationFn: async () => {
      const { data } = await api.delete(endpoints.algorithms.removeAllWithFiles)
      return data as { algorithmsProcessed: number; filesDeleted: number }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['algorithms'] })
      // Immediately clear availableAlgorithms cache for snappier UI
      qc.setQueryData(['availableAlgorithms'], [] as string[])
      qc.invalidateQueries({ queryKey: ['availableAlgorithms'] })
    },
  })
}

export type DpqlQueryPayload = {
  query: string
  engineId?: number
  normalizedOnly?: boolean
  dataset?: string
  basePath?: string
  separator?: string
  quoteChar?: string
  cached?: boolean
  engineParameters?: Record<string, string>
}

export function useDpqlExecute() {
  return useMutation<{ executionId: string }, any, DpqlQueryPayload>({
    mutationFn: async (payload: DpqlQueryPayload) => {
      const { data } = await api.post(endpoints.dpql.execute, payload)
      return data as { executionId: string }
    },
  })
}

export function useDpqlResultOverview(executionId?: string, poll?: boolean) {
  return useQuery<DpqlOverviewResponse>({
    queryKey: ['dpqlOverview', executionId],
    queryFn: async () => {
      if (!executionId) throw new Error('Missing executionId')
      const { data } = await api.get(endpoints.dpql.results(executionId))
      return data as DpqlOverviewResponse
    },
    enabled: !!executionId,
    refetchInterval: poll ? 1000 : false,
  })
}

export function useDpqlTablePage(executionId: string | undefined, tableId: number, offset: number, limit: number, search?: string) {
  return useQuery<DpqlTablePageResponse>({
    queryKey: ['dpqlTablePage', executionId, tableId, offset, limit, search],
    queryFn: async () => {
      if (!executionId) throw new Error('Missing executionId')
      const { data } = await api.get(endpoints.dpql.tablePage(executionId, tableId, offset, limit, search))
      return data as DpqlTablePageResponse
    },
    enabled: !!executionId && tableId > 0,
    placeholderData: keepPreviousData,
  })
}

export function useDpqlNormalizedTablePage(executionId: string | undefined, tableId: number, offset: number, limit: number, search?: string) {
  return useQuery<DpqlNormalizedTablePageResponse>({
    queryKey: ['dpqlNormalizedTablePage', executionId, tableId, offset, limit, search],
    queryFn: async () => {
      if (!executionId) throw new Error('Missing executionId')
      const { data } = await api.get(endpoints.dpql.normalizedTablePage(executionId, tableId, offset, limit, search))
      return data as DpqlNormalizedTablePageResponse
    },
    enabled: !!executionId && tableId > 0,
    placeholderData: keepPreviousData,
  })
}

export function useDpqlRunStatus(executionId?: string) {
  return useQuery<DpqlRunStatus>({
    queryKey: ['dpqlRunStatus', executionId],
    queryFn: async () => {
      if (!executionId) throw new Error('Missing executionId')
      const { data } = await api.get(endpoints.dpql.runStatus(executionId))
      return data as DpqlRunStatus
    },
    enabled: !!executionId,
    refetchInterval: (q) => {
      const s = (q.state.data as any)?.status as string | undefined
      return s === 'RUNNING' || s === 'QUEUED' ? 1000 : false
    },
  })
}

export function useDpqlCancelRun() {
  return useMutation<{ status: string }, any, { executionId: string }>({
    mutationFn: async ({ executionId }) => {
      const { data } = await api.post(endpoints.dpql.cancelRun(executionId))
      return data as { status: string }
    },
  })
}

export function useDpqlExpand() {
  return useMutation<DpqlExpandResponse, any, DpqlExpandRequest>({
    mutationFn: async (payload: DpqlExpandRequest) => {
      const { data } = await api.post(endpoints.dpql.expand, payload)
      return data as DpqlExpandResponse
    },
  })
}
