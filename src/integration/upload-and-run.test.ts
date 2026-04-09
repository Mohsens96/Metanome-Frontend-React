import { describe, it, expect, vi } from 'vitest'
import { useUploadFile, useStartExecution } from '../api/hooks'
import { renderHook, act } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('../api/axios', () => {
  return {
    default: {
      post: vi.fn((url: string) => {
        if (url.includes('/file-inputs/store')) return Promise.resolve({ data: { id: 1 } })
        if (url.includes('/algorithm-execution')) return Promise.resolve({ data: { id: 42, status: 'QUEUED' } })
        return Promise.resolve({ data: {} })
      }),
    },
  }
})

describe('Upload + Run flow', () => {
  it('uploads a file and starts execution', async () => {
    const qc = new QueryClient()
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children)

    const upload = renderHook(() => useUploadFile(), { wrapper })
    const start = renderHook(() => useStartExecution(), { wrapper })

    await act(async () => {
      const fd = new FormData()
      fd.append('file', new File([''], 'a.csv'))
      await upload.result.current.mutateAsync(fd)
    })

    await act(async () => {
      await start.result.current.mutateAsync({ algorithmId: 1, inputId: 1 })
    })

    expect(start.result.current.isSuccess).toBe(true)
  })
})
