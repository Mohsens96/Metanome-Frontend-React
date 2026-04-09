import { render, fireEvent } from '@testing-library/react'
import FileUploader from '../FileUploader'
import React from 'react'

it('calls onUpload when file selected', () => {
  const mock = vi.fn()
  const { getByText, container } = render(<FileUploader onUpload={mock} />)
  const input = container.querySelector('input[type=file]') as HTMLInputElement
  const file = new File(['a,b\n1,2'], 'test.csv', { type: 'text/csv' })
  fireEvent.change(input, { target: { files: [file] } })
  // File input handlers are synchronous here
  expect(mock).toHaveBeenCalled()
})
