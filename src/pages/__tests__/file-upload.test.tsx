import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import UploadAlgorithm from '../UploadAlgorithm'
import { useUploadAlgorithm } from '../../api/hooks'

vi.mock('../../api/hooks', () => ({
  useUploadAlgorithm: vi.fn(),
}))

describe('UploadAlgorithm', () => {
  it('enables upload after selecting a file and submits the selected jar', () => {
    const mutate = vi.fn()
    vi.mocked(useUploadAlgorithm).mockReturnValue({
      mutate,
      isPending: false,
      isError: false,
      isSuccess: false,
      error: null,
    } as any)

    const { container } = render(<UploadAlgorithm />)

    const submitButton = screen.getByRole('button', { name: 'Upload' })
    expect(submitButton).toBeDisabled()

    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['fake-jar'], 'demo-algorithm.jar', { type: 'application/java-archive' })

    fireEvent.change(input, { target: { files: [file] } })

    expect(submitButton).toBeEnabled()

    fireEvent.click(submitButton)

    expect(mutate).toHaveBeenCalledWith(file)
  })
})