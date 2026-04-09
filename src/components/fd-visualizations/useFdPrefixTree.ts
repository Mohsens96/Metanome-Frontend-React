import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import api from '../../api/axios'
import { endpoints } from '../../api/endpoints'
import type { FdPrefixTreeNode } from './types'

/**
 * Loads the legacy-style FD prefix tree JSON.
 *
 * Assumption (repo convention): backend exposes static frontend assets under `/visualization/**`.
 * If that isn't true in your deployment, we can switch this to a dedicated API endpoint.
 */
export function useFdPrefixTree(executionId: number | null, enabled: boolean) {
  return useQuery<FdPrefixTreeNode>({
    queryKey: ['fdPrefixTree', executionId],
    enabled: enabled && executionId != null,
    queryFn: async () => {
      // Preferred: call dedicated API endpoint (works even if static /visualization isn't served)
      try {
        const { data } = await api.get('/visualization/fd/prefix-tree')
        return data as FdPrefixTreeNode
      } catch {
        // ignore -> fall back
      }

      // Best-effort: fetch generated JSON from backendwar static resources.
      // Note: `endpoints` might not have a route for this; we fall back to raw URL.
      const url = (endpoints as any)?.visualization?.fdPrefixTree?.(executionId)
      if (typeof url === 'string') {
        const { data } = await api.get(url)
        return data as FdPrefixTreeNode
      }

      // Fallback: legacy relative path used by old UI.
      // If your backend is mounted below a base path, Axios baseURL should handle it.
      // `api` is configured with `/api` baseURL. Visualization JSON is usually a static asset
      // served from the backend root, so we need to bypass the `/api` prefix.
      const base = api.defaults.baseURL?.toString().replace(/\/api\/?$/, '')
      const staticClient = axios.create({ baseURL: base || '' })
      const { data } = await staticClient.get('/visualization/FDResultAnalyzer/PrefixTree.json')
      return data as FdPrefixTreeNode
    },
    retry: 1,
    refetchOnWindowFocus: false,
    staleTime: 0,
  })
}
