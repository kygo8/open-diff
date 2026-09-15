import { invoke } from '@tauri-apps/api/core'
import { isTauriRuntime } from '@/app/desktopDrop'

export interface PathVolumeInfo {
  path: string
  freeBytes: number
  displayRoot: string
}

const GiB = 1024 ** 3
const MiB = 1024 ** 2

/** Capture-aligned quantity like `91.8 GB` or `512 MB`. */
export function formatFreeSpaceQuantity(freeBytes: number): string {
  if (!Number.isFinite(freeBytes) || freeBytes < 0) {
    return ''
  }

  if (freeBytes >= GiB) {
    const value = freeBytes / GiB
    const digits = value >= 100 ? 0 : 1

    return `${value.toFixed(digits)} GB`
  }

  const value = freeBytes / MiB
  let digits = 0

  if (value >= 10 && value < 100) {
    digits = 1
  }

  return `${Math.max(0, value).toFixed(digits)} MB`
}

export function formatDiskFreeSpacePhrase(freeBytes: number, displayRoot: string): string {
  const quantity = formatFreeSpaceQuantity(freeBytes)

  if (!quantity || !displayRoot) {
    return ''
  }

  return `${quantity} free on ${displayRoot}`
}

export async function fetchPathVolumeInfo(path: string): Promise<PathVolumeInfo | null> {
  const trimmed = path.trim()

  if (!trimmed || !isTauriRuntime()) {
    return null
  }

  try {
    return await invoke<PathVolumeInfo>('path_volume_info', { path: trimmed })
  } catch {
    return null
  }
}
