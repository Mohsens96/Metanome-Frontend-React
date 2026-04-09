import { render } from '@testing-library/react'
import Button from '../Button'
import React from 'react'

describe('Button', () => {
  it('renders children', () => {
    const { getByText } = render(<Button>Click</Button>)
    expect(getByText('Click')).toBeInTheDocument()
  })
})
