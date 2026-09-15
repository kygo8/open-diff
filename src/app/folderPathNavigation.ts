/** In-memory Back/Forward stack for folder path browsing (session-scoped). */

export interface FolderPathNavStack<T> {
  past: T[]
  present: T | null
  future: T[]
}

export function createFolderPathNavStack<T>(): FolderPathNavStack<T> {
  return { past: [], present: null, future: [] }
}

export function folderPathNavCanBack<T>(stack: FolderPathNavStack<T>): boolean {
  return stack.past.length > 0
}

export function folderPathNavCanForward<T>(stack: FolderPathNavStack<T>): boolean {
  return stack.future.length > 0
}

export function folderPathNavCommit<T>(
  stack: FolderPathNavStack<T>,
  next: T,
  equal: (left: T, right: T) => boolean = Object.is,
): FolderPathNavStack<T> {
  if (stack.present !== null && equal(stack.present, next)) {
    return stack
  }

  if (stack.present === null) {
    return { past: [], present: next, future: [] }
  }

  return {
    past: [...stack.past, stack.present],
    present: next,
    future: [],
  }
}

export function folderPathNavBack<T>(
  stack: FolderPathNavStack<T>,
): { stack: FolderPathNavStack<T>; entry: T } | undefined {
  if (stack.past.length === 0 || stack.present === null) {
    return undefined
  }

  const previous = stack.past[stack.past.length - 1]

  return {
    entry: previous,
    stack: {
      past: stack.past.slice(0, -1),
      present: previous,
      future: [stack.present, ...stack.future],
    },
  }
}

export function folderPathNavForward<T>(
  stack: FolderPathNavStack<T>,
): { stack: FolderPathNavStack<T>; entry: T } | undefined {
  if (stack.future.length === 0 || stack.present === null) {
    return undefined
  }

  const next = stack.future[0]

  return {
    entry: next,
    stack: {
      past: [...stack.past, stack.present],
      present: next,
      future: stack.future.slice(1),
    },
  }
}

export interface FolderPathPair {
  left: string
  right: string
}

export function folderPathPairsEqual(left: FolderPathPair, right: FolderPathPair): boolean {
  return left.left === right.left && left.right === right.right
}

export interface FolderMergePathTriple {
  left: string
  base: string
  right: string
}

export function folderMergePathTriplesEqual(
  left: FolderMergePathTriple,
  right: FolderMergePathTriple,
): boolean {
  return left.left === right.left && left.base === right.base && left.right === right.right
}
