/** Helpers for Options Tweaks disk-change reload behavior. */
import type { FileStamp } from '@/types/diff'

export interface DiskChangeSide {
  path: string
  stamp: FileStamp | null
}

export type DiskChangeChecker = (path: string, previousStamp: FileStamp) => Promise<boolean>

/** True when any side path's stamp no longer matches disk. */
export async function anyPathChangedOnDisk(
  sides: DiskChangeSide[],
  check: DiskChangeChecker,
): Promise<boolean> {
  for (const side of sides) {
    if (!side.path || !side.stamp) {
      continue
    }

    try {
      if (await check(side.path, side.stamp)) {
        return true
      }
    } catch {
      // ponytail: missing/unreadable paths are not treated as disk changes
    }
  }

  return false
}

/** Auto-reload only when the tweak is on and the view has no unsaved edits. */
export function shouldAutoReloadDiskChange(input: {
  autoReloadUnlessChangesDiscarded: boolean
  dirty: boolean
}): boolean {
  return input.autoReloadUnlessChangesDiscarded && !input.dirty
}

export const FOLDER_WATCH_REFRESH_MS = 30_000

export const BINARY_COMPARE_BUFFER_CHOICES = [256, 512, 1024, 2048, 4096] as const

export type BinaryCompareBufferSize = (typeof BINARY_COMPARE_BUFFER_CHOICES)[number]

export function clampBinaryCompareBufferSize(value: unknown): BinaryCompareBufferSize {
  const numeric = typeof value === 'number' ? value : Number(value)

  if (!Number.isFinite(numeric)) {
    return 256
  }

  const rounded = Math.floor(numeric)
  let best: BinaryCompareBufferSize = 256
  let bestDistance = Number.POSITIVE_INFINITY

  for (const choice of BINARY_COMPARE_BUFFER_CHOICES) {
    const distance = Math.abs(choice - rounded)

    if (distance < bestDistance) {
      best = choice
      bestDistance = distance
    }
  }

  return best
}
