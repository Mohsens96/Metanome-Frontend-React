import { useMemo } from 'react'
import * as d3 from 'd3'
import type { FdPrefixTreeNode } from './types'

type Props = {
  data: FdPrefixTreeNode
  width?: number
  height?: number
}

/**
 * Compact, readable prefix tree (static) inspired by legacy `PrefixTree.html`.
 *
 * This isn't collapsible yet; we can add expand/collapse interactions next.
 */
export function FdPrefixTree({ data, width = 1100, height = 520 }: Props) {
  const { nodes, links } = useMemo(() => {
    const root = d3.hierarchy<FdPrefixTreeNode>(data)
    const layout = d3.tree<FdPrefixTreeNode>().size([height - 40, width - 200])
    const tree = layout(root)

    return {
      nodes: tree.descendants(),
      links: tree.links(),
    }
  }, [data, width, height])

  return (
    <svg width={width} height={height} role="img" aria-label="Functional Dependency Prefix Tree">
      <g transform="translate(100,20)">
        {links.map((l: d3.HierarchyLink<FdPrefixTreeNode>, idx: number) => (
          <path
            key={idx}
            d={`M${l.source.y},${l.source.x} C${(l.source.y + l.target.y) / 2},${l.source.x} ${(l.source.y + l.target.y) / 2},${l.target.x} ${l.target.y},${l.target.x}`}
            fill="none"
            stroke="#cbd5e1"
            strokeWidth={1.5}
          />
        ))}

        {nodes.map((n: d3.HierarchyPointNode<FdPrefixTreeNode>, idx: number) => {
          const isRoot = n.depth === 0
          return (
            <g key={idx} transform={`translate(${n.y},${n.x})`}>
              <circle r={isRoot ? 6 : 4} fill={isRoot ? '#0ea5e9' : '#fff'} stroke="#64748b" strokeWidth={1.5} />
              <text x={10} dy="0.32em" fontSize={12} fill="#0f172a">
                {n.data.name}
              </text>
            </g>
          )
        })}
      </g>
    </svg>
  )
}
