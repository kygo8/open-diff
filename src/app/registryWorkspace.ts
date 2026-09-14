/** Registry compare workspace helpers. Live Windows writes go through applyLiveRegistryValue. */

export type RegistryWorkspaceStatus = 'added' | 'removed' | 'modified' | 'unchanged'

export interface RegistryWorkspaceSide {
  kind: string
  data: string
}

export interface RegistryWorkspaceValue {
  keyPath: string
  name: string
  status: RegistryWorkspaceStatus
  left?: RegistryWorkspaceSide
  right?: RegistryWorkspaceSide
}

export type RegistryValueFilter = 'all' | 'diffs' | 'same'

export function registryValueMatchesFilter(
  status: RegistryWorkspaceStatus,
  filter: RegistryValueFilter,
): boolean {
  if (filter === 'all') {
    return true
  }

  if (filter === 'same') {
    return status === 'unchanged'
  }

  return status !== 'unchanged'
}

export function applyRegistryValueSide(
  value: RegistryWorkspaceValue,
  source: 'left' | 'right',
): RegistryWorkspaceValue {
  const side = value[source]

  if (!side) {
    return value
  }

  const next: RegistryWorkspaceValue = {
    ...value,
    left: source === 'left' ? value.left : { ...side },
    right: source === 'right' ? value.right : { ...side },
  }

  if (
    next.left?.kind === next.right?.kind &&
    next.left?.data === next.right?.data &&
    next.left &&
    next.right
  ) {
    next.status = 'unchanged'
  } else if (next.left && !next.right) {
    next.status = 'removed'
  } else if (!next.left && next.right) {
    next.status = 'added'
  } else {
    next.status = 'modified'
  }

  return next
}

export function collectExpandableKeyPaths(
  nodes: { path: string; children: unknown[] }[],
): string[] {
  const paths: string[] = []

  for (const node of nodes) {
    if (node.children.length > 0) {
      paths.push(node.path)
      paths.push(
        ...collectExpandableKeyPaths(node.children as { path: string; children: unknown[] }[]),
      )
    }
  }

  return paths
}
