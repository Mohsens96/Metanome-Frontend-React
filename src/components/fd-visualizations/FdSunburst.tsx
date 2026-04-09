import { useMemo } from 'react'
import * as d3 from 'd3'
import type { FdPrefixTreeNode } from './types'

type Props = {
  data: FdPrefixTreeNode
  width?: number
  height?: number
}

/**
 * React re-implementation of legacy ZoomableSunburst (D3 v3) using D3 v7.
 *
 * Contract:
 * - Input: legacy prefix-tree JSON (name, children, optional keyError, tableSize)
 * - Output: SVG sunburst with tooltip + breadcrumb-ish info via <title>
 */
export function FdSunburst({ data, width = 900, height = 420 }: Props) {
  const { arcs, radius } = useMemo(() => {
    const r = Math.min(width, height) / 2
    const root = d3
      .hierarchy<FdPrefixTreeNode>(data)
      .sum(() => 1)
      .sort(
        (a: d3.HierarchyNode<FdPrefixTreeNode>, b: d3.HierarchyNode<FdPrefixTreeNode>) =>
          (b.depth ?? 0) - (a.depth ?? 0)
      )

    const partition = d3.partition<FdPrefixTreeNode>().size([2 * Math.PI, r])
    partition(root)

    const arcGen = d3
      .arc<d3.HierarchyRectangularNode<FdPrefixTreeNode>>()
      .startAngle((d: d3.HierarchyRectangularNode<FdPrefixTreeNode>) => d.x0)
      .endAngle((d: d3.HierarchyRectangularNode<FdPrefixTreeNode>) => d.x1)
      .innerRadius((d: d3.HierarchyRectangularNode<FdPrefixTreeNode>) => d.y0)
      .outerRadius((d: d3.HierarchyRectangularNode<FdPrefixTreeNode>) => d.y1)

    const color = d3.scaleOrdinal(d3.quantize(d3.interpolateRainbow, root.descendants().length + 1))

    const computed: Array<{
      node: d3.HierarchyRectangularNode<FdPrefixTreeNode>
      path?: string
      fill: string
    }> = root
      .descendants()
      .filter((d: d3.HierarchyRectangularNode<FdPrefixTreeNode>) => d.depth > 0)
      .map((d: d3.HierarchyRectangularNode<FdPrefixTreeNode>, i: number) => ({
        node: d,
        path: arcGen(d) || undefined,
        fill: color(String(i)),
      }))

    return { arcs: computed, radius: r }
  }, [data, width, height])

  const labelTransform = (node: d3.HierarchyRectangularNode<FdPrefixTreeNode>) => {
    // Place label at arc centroid, then rotate so it's readable.
    const angle = ((node.x0 + node.x1) / 2) * (180 / Math.PI)
    const r = (node.y0 + node.y1) / 2
    // Flip labels on the left side so text isn't upside down.
    const rotate = angle - 90
    const flip = angle >= 180 ? 180 : 0
    return `rotate(${rotate}) translate(${r},0) rotate(${flip})`
  }

  const labelVisible = (node: d3.HierarchyRectangularNode<FdPrefixTreeNode>) => {
    // Heuristic: show labels only if there is enough angular + radial space.
    const angular = node.x1 - node.x0
    const radial = node.y1 - node.y0
    return node.depth > 0 && angular > 0.06 && radial > 10
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`${-width / 2} ${-height / 2} ${width} ${height}`}
      role="img"
      aria-label="Functional Dependency Sunburst"
      style={{ overflow: 'visible' }}
    >
      {/* With a centered viewBox, (0,0) is already the center. */}
      <g>
        {arcs.map(
          (
            item: { node: d3.HierarchyRectangularNode<FdPrefixTreeNode>; path?: string; fill: string },
            idx: number
          ) => {
            const { node, path, fill } = item
          if (!path) return null
          const keyError = node.data.keyError
          const tableSize = data.tableSize
          const label = node.data.name
          const diagnostics =
            keyError == null
              ? ''
              : keyError === 0
                ? 'valid FD'
                : tableSize != null
                  ? `${keyError}/${tableSize} duplicates preventing FD`
                  : `${keyError} duplicates preventing FD`

            return (
            <g key={idx}>
              <path d={path} fill={fill} stroke="#fff" strokeWidth={1} opacity={0.95}>
                <title>{`${label}${diagnostics ? `\n${diagnostics}` : ''}`}</title>
              </path>

              {labelVisible(node) && (
                <text
                  transform={labelTransform(node)}
                  textAnchor={((node.x0 + node.x1) / 2) * (180 / Math.PI) >= 180 ? 'end' : 'start'}
                  dominantBaseline="middle"
                  fontSize={11}
                  fill="#0f172a"
                  pointerEvents="none"
                >
                  {label}
                </text>
              )}
            </g>
            )
          }
        )}

        <circle r={Math.max(0, radius * 0.05)} fill="#fff" opacity={0.9} />
      </g>
    </svg>
  )
}
