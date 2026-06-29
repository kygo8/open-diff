export type DropSourceKind = 'file' | 'directory' | 'unknown'

export type DropClassificationKind = 'files' | 'folders' | 'mixed' | 'patch' | 'invalid'

export interface DropInput {
  path: string
  kind: DropSourceKind
}

export interface ClassifiedDropItem extends DropInput {
  displayName: string
  sourceKind: Exclude<DropSourceKind, 'unknown'>
}

export interface ValidDropClassification {
  kind: Exclude<DropClassificationKind, 'invalid'>
  left: ClassifiedDropItem
  right: ClassifiedDropItem
}

export interface InvalidDropClassification {
  kind: 'invalid'
  reason: string
}

export type DropClassification = ValidDropClassification | InvalidDropClassification

export function classifyDropInputs(inputs: DropInput[]): DropClassification {
  if (inputs.length === 1) {
    const [only] = inputs.map(toClassifiedDropItem)

    if (only && isPatchPath(only.path)) {
      return { kind: 'patch', left: only, right: only }
    }
  }

  if (inputs.length !== 2) {
    return { kind: 'invalid', reason: 'Drop exactly two files or folders.' }
  }

  const [left, right] = inputs.map(toClassifiedDropItem)

  if (!left || !right) {
    return { kind: 'invalid', reason: 'Only files and folders can be compared.' }
  }

  if (left.sourceKind === 'file' && right.sourceKind === 'file') {
    return { kind: 'files', left, right }
  }

  if (left.sourceKind === 'directory' && right.sourceKind === 'directory') {
    return { kind: 'folders', left, right }
  }

  return { kind: 'mixed', left, right }
}

export function pathDisplayName(path: string): string {
  const normalized = path.replaceAll('\\', '/').replace(/\/+$/u, '')
  const segment = normalized.split('/').filter(Boolean).at(-1)

  return segment ?? path
}

function toClassifiedDropItem(input: DropInput): ClassifiedDropItem | undefined {
  if (input.kind === 'unknown') {
    return undefined
  }

  return {
    ...input,
    displayName: pathDisplayName(input.path),
    sourceKind: input.kind,
  }
}

function isPatchPath(path: string): boolean {
  const lower = path.toLowerCase()

  return lower.endsWith('.diff') || lower.endsWith('.patch')
}
