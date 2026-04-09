import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PaginatedResultTable } from '../DpqlConsole'
import { useDpqlTablePage } from '../../api/hooks'

vi.mock('../../api/axios', () => ({
  default: {
    get: vi.fn(),
  },
}))

vi.mock('../../api/hooks', async () => {
  const actual = await vi.importActual<typeof import('../../api/hooks')>('../../api/hooks')
  return {
    ...actual,
    useDpqlTablePage: vi.fn(),
  }
})

describe('PaginatedResultTable', () => {
  it('shows scaling controls for large result pages without rendering a huge DOM', () => {
    const largeRows = Array.from({ length: 100 }, (_, index) => [`row-${index}`, `value-${index}`])

    vi.mocked(useDpqlTablePage).mockReturnValue({
      data: {
        table: {
          tableId: 7,
          name: 'Large Result',
          kind: 'TABLE',
          columns: ['A', 'B'],
        },
        rows: largeRows,
      },
      isLoading: false,
      isError: false,
    } as any)

    render(
      <PaginatedResultTable
        executionId="exec-1"
        tableId={7}
        initialTableInfo={{ tableId: 7, name: 'Large Result', kind: 'TABLE', columns: ['A', 'B'] }}
        fallbackLabel="Result 1"
        canExport={false}
      />,
    )

    expect(screen.getByPlaceholderText('Search results...')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Prev' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled()
    expect(screen.getByText('100 rows shown (Page 1)')).toBeInTheDocument()
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByText('Large Result')).toBeInTheDocument()
  })
})