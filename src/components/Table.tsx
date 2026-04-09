import React from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'

export type Column<T> = { key: string; title: string; render?: (row: T) => React.ReactNode }

const DEFAULT_VIRTUALIZE_THRESHOLD = 100

export default function Table<T>({
  columns,
  data,
  rowClassName,
}: {
  columns: Column<T>[]
  data: T[]
  rowClassName?: (row: T, index: number) => string | undefined
}) {
  const shouldVirtualize = data.length > DEFAULT_VIRTUALIZE_THRESHOLD
  const scrollParentRef = React.useRef<HTMLDivElement | null>(null)

  const rowVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => scrollParentRef.current,
    estimateSize: () => 36,
    overscan: 10,
    enabled: shouldVirtualize,
  })

  return (
    <div
      ref={shouldVirtualize ? scrollParentRef : undefined}
      className={
        shouldVirtualize
          ? 'overflow-auto max-h-[70vh] bg-white rounded-md shadow-sm'
          : 'overflow-x-auto bg-white rounded-md shadow-sm'
      }
    >
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className="px-4 py-2 text-left text-sm font-medium text-muted">
                {c.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {data.length === 0 ? null : shouldVirtualize ? (
            (() => {
              const virtualRows = rowVirtualizer.getVirtualItems()
              const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0
              const paddingBottom =
                virtualRows.length > 0
                  ? rowVirtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end
                  : 0

              return (
                <>
                  {paddingTop > 0 && (
                    <tr>
                      <td colSpan={columns.length} className="p-0" style={{ height: paddingTop }} />
                    </tr>
                  )}
                  {virtualRows.map((virtualRow) => {
                    const row = data[virtualRow.index]
                    const extra = rowClassName ? rowClassName(row, virtualRow.index) : ''
                    return (
                      <tr
                        key={virtualRow.key}
                        className={['hover:bg-gray-50', extra].filter(Boolean).join(' ')}
                      >
                        {columns.map((c) => (
                          <td key={c.key} className="px-4 py-2 text-sm">
                            {c.render ? c.render(row) : (row as any)?.[c.key]}
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                  {paddingBottom > 0 && (
                    <tr>
                      <td colSpan={columns.length} className="p-0" style={{ height: paddingBottom }} />
                    </tr>
                  )}
                </>
              )
            })()
          ) : (
            data.map((row, idx) => {
              const extra = rowClassName ? rowClassName(row, idx) : ''
              return (
                <tr key={idx} className={['hover:bg-gray-50', extra].filter(Boolean).join(' ')}>
                  {columns.map((c) => (
                    <td key={c.key} className="px-4 py-2 text-sm">
                      {c.render ? c.render(row) : (row as any)?.[c.key]}
                    </td>
                  ))}
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
