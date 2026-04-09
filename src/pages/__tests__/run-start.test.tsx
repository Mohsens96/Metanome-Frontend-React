import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import RunProfile from '../RunProfile'
import { useAlgorithmParameters, useExecution, useFileInputs, useStartExecution } from '../../api/hooks'

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query')
  return {
    ...actual,
    useQuery: vi.fn(),
  }
})

vi.mock('../../api/axios', () => ({
  default: {
    get: vi.fn(),
  },
}))

vi.mock('../../components/Toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}))

vi.mock('../../api/hooks', async () => {
  const actual = await vi.importActual<typeof import('../../api/hooks')>('../../api/hooks')
  return {
    ...actual,
    useFileInputs: vi.fn(),
    useStartExecution: vi.fn(),
    useExecution: vi.fn(),
    useAlgorithmParameters: vi.fn(),
  }
})

import { useQuery } from '@tanstack/react-query'

describe('RunProfile', () => {
  it('keeps the primary action disabled until required algorithm and dataset are selected', () => {
    vi.mocked(useQuery).mockReturnValue({
      data: [
        { id: 1, name: 'FD Algorithm', fileName: 'fd.jar', fileInput: true },
      ],
      isLoading: false,
      isError: false,
    } as any)

    vi.mocked(useFileInputs).mockReturnValue({
      data: [
        { id: 11, name: 'customers.csv', fileName: 'customers.csv' },
      ],
      isLoading: false,
      isError: false,
    } as any)

    vi.mocked(useAlgorithmParameters).mockReturnValue({
      data: undefined,
      isLoading: false,
    } as any)

    vi.mocked(useStartExecution).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      isSuccess: false,
      data: undefined,
    } as any)

    vi.mocked(useExecution).mockReturnValue({ data: undefined } as any)

    render(<RunProfile />)

    const startButton = screen.getByRole('button', { name: 'Start run' })
    expect(startButton).toBeDisabled()

    const textboxes = screen.getAllByRole('textbox')
    const algorithmInput = textboxes.find((element) => element.getAttribute('placeholder') === 'Select an algorithm…')
    const datasetInput = textboxes.find((element) => element.getAttribute('placeholder') === 'Select a dataset…')

    expect(algorithmInput).toBeTruthy()
    expect(datasetInput).toBeTruthy()

    fireEvent.focus(algorithmInput as HTMLElement)
    fireEvent.click(screen.getByRole('button', { name: /FD Algorithm/i }))
    expect(startButton).toBeDisabled()

    fireEvent.focus(datasetInput as HTMLElement)
    const datasetMenu = screen.getByRole('button', { name: /customers.csv/i })
    fireEvent.click(datasetMenu)

    expect(startButton).toBeEnabled()
  })
})