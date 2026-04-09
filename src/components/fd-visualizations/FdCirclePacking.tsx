import { useMemo } from 'react'
import * as d3 from 'd3'
import type { FdPrefixTreeNode } from './types'

type Props = {
  data: FdPrefixTreeNode
  width?: number
  height?: number
}

/** Zoomable circle-packing approximation of the legacy `CirclePacking.html`. */
export function FdCirclePacking({ data, width = 900, height = 420 }: Props) {
  const { nodes } = useMemo(() => {
    const diameter = Math.min(width, height)

    const root = d3
      .hierarchy<FdPrefixTreeNode>(data)
      .sum((d: FdPrefixTreeNode) => d.size ?? 1)
      .sort((a: d3.HierarchyNode<FdPrefixTreeNode>, b: d3.HierarchyNode<FdPrefixTreeNode>) => (b.value ?? 0) - (a.value ?? 0))

    const pack = d3.pack<FdPrefixTreeNode>().size([diameter, diameter]).padding(2)
    const packed = pack(root)

    const all: Array<d3.HierarchyCircularNode<FdPrefixTreeNode>> = packed.descendants()

    return { nodes: all }
  }, [data, width, height])

  const color = useMemo(() => {
    return d3
      .scaleLinear<string>()
      .domain([-1, 5])
      .range(['hsl(152,80%,80%)', 'hsl(228,30%,40%)'])
      .interpolate(d3.interpolateHcl)
  }, [])

  const diameter = Math.min(width, height)

  const shouldShowLabel = (n: d3.HierarchyCircularNode<FdPrefixTreeNode>) => {
    // Only show if there is enough room and it's not the root.
    if (n.depth === 0) return false
    return n.r >= 18
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Functional Dependency Circle Packing"
      style={{ overflow: 'visible' }}
    >
      <g transform={`translate(${(width - diameter) / 2},${(height - diameter) / 2})`}>
        {nodes.map((n, idx) => {
          const isRoot = n.depth === 0
          const isLeaf = !n.children || n.children.length === 0
          const fill = isRoot ? color(-1) : n.children ? color(Math.min(5, n.depth)) : 'white'
          const label = n.data.name
          return (
            <g key={idx} transform={`translate(${n.x},${n.y})`}>
              <defs>
                <clipPath id={`fd-pack-clip-${idx}`}>
                  <circle r={Math.max(0, n.r - 1)} />
                </clipPath>
              </defs>

              <circle r={n.r} fill={fill} stroke={isLeaf ? '#94a3b8' : 'none'} strokeWidth={1} opacity={0.95}>
                <title>{label}</title>
              </circle>
              {shouldShowLabel(n) && (
                <text
                  clipPath={`url(#fd-pack-clip-${idx})`}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={Math.max(10, Math.min(14, n.r * 0.32))}
                  fill="#0f172a"
                  pointerEvents="none"
                >
                  {label}
                </text>
              )}
            </g>
          )
        })}
      </g>
    </svg>
  )
}
