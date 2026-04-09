export type FdPrefixTreeNode = {
  name: string
  /** present on root only */
  tableSize?: number
  /** present on non-root nodes */
  size?: number
  /** present on non-root nodes */
  keyError?: number
  children?: FdPrefixTreeNode[]
}
