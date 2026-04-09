import { render } from '@testing-library/react'
import Table from '../Table'
import React from 'react'

describe('Table', () => {
  it('renders rows', () => {
    const data = [{ id: 1, name: 'a' }, { id: 2, name: 'b' }]
    const { getByText } = render(<Table columns={[{ key: 'name', title: 'Name' }]} data={data} />)
    expect(getByText('a')).toBeInTheDocument()
  })
})
