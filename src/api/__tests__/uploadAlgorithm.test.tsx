import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { it, expect, vi } from 'vitest'
import { useUploadAlgorithm } from '../hooks'
import api from '../axios'

vi.mock('../axios', () => {
  return {
    default: {
      post: vi.fn().mockResolvedValue({ data: { ok: true } }),
    },
  }
})

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient()
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

function TestComponent() {
  const upload = useUploadAlgorithm()
  return (
    <button onClick={() => {
      const f = new File(['fakejar'], 'algo.jar', { type: 'application/java-archive' })
      upload.mutate(f)
    }}>upload</button>
  )
}

it('uploads algorithm without forcing multipart header', async () => {
  const { getByText } = render(<TestComponent />, { wrapper: Wrapper })
  fireEvent.click(getByText('upload'))
  await waitFor(() => expect((api as any).post).toHaveBeenCalled())
  const call = (api as any).post.mock.calls[0]
  expect(call[0]).toBe('/algorithms/store')
  // second arg is FormData
  expect(call[1] instanceof FormData).toBe(true)
  // third arg should be undefined or without explicit Content-Type to let browser set boundary
  if (call[2]) {
    expect(call[2].headers?.['Content-Type']).toBeUndefined()
  }
})
