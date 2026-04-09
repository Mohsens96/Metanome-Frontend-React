import React from 'react'
import Button from '../../components/Button'
import Table from '../../components/Table'

const sample = [{ id: 1, name: 'data.csv', size: 1234, createdAt: '2025-10-01' }]

export default function Demo(){
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Component demo</h1>
      <div>
        <Button>Primary action</Button>
      </div>
      <Table columns={[{ key: 'name', title: 'Name' }, { key: 'size', title: 'Size' }]} data={sample} />
    </div>
  )
}
