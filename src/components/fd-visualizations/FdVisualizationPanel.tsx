import { useMemo, useState } from 'react'
import type { FdPrefixTreeNode } from './types'
import { FdSunburst } from './FdSunburst'
import { FdCirclePacking } from './FdCirclePacking'
import { FdPrefixTree } from './FdPrefixTree'

type ViewMode = 'sunburst' | 'packing' | 'tree'

type Props = {
  data: FdPrefixTreeNode
}

export function FdVisualizationPanel({ data }: Props) {
  const [mode, setMode] = useState<ViewMode>('sunburst')

  const header = useMemo(() => {
    const title =
      mode === 'sunburst'
        ? 'Sunburst'
        : mode === 'packing'
          ? 'Circle Packing'
          : 'Prefix Tree'
    return title
  }, [mode])

  return (
    <div className="mt-4 rounded-md border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-col gap-2 p-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-sm font-semibold">FD Visualization — {header}</div>
          <div className="text-xs text-muted">Based on legacy Metanome FDResultAnalyzer PrefixTree.json</div>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="text-sm border border-gray-300 rounded px-2 py-1 bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
            value={mode}
            onChange={(e) => setMode(e.target.value as ViewMode)}
          >
            <option value="sunburst">Sunburst</option>
            <option value="packing">Circle Packing</option>
            <option value="tree">Prefix Tree</option>
          </select>
        </div>
      </div>

      <div className="p-3 overflow-auto">
        {mode === 'sunburst' && <FdSunburst data={data} />}
        {mode === 'packing' && <FdCirclePacking data={data} />}
        {mode === 'tree' && <FdPrefixTree data={data} />}
      </div>
    </div>
  )
}
