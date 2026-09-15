export const hexCompareSessionOptionsStorageKey = 'open-diff-hex-compare-session-options'

export type HexBytesPerRowPreference = 'auto' | '8' | '16'

export interface HexCompareSessionOptions {
  windowLength: number
  diffOnly: boolean
  bytesPerRow: HexBytesPerRowPreference
}

export function defaultHexCompareSessionOptions(): HexCompareSessionOptions {
  return {
    windowLength: 256,
    diffOnly: false,
    bytesPerRow: 'auto',
  }
}

function clampWindowLength(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value)

  if (!Number.isFinite(numeric)) {
    return 256
  }

  return Math.min(4096, Math.max(16, Math.floor(numeric)))
}

export function normalizeHexBytesPerRow(value: unknown): HexBytesPerRowPreference {
  if (value === 8 || value === '8') {
    return '8'
  }

  if (value === 16 || value === '16') {
    return '16'
  }

  return 'auto'
}

export function resolveHexBytesPerRow(
  preference: HexBytesPerRowPreference,
  viewportWidth: number,
): number {
  if (preference === '8') {
    return 8
  }

  if (preference === '16') {
    return 16
  }

  return viewportWidth < 480 ? 8 : 16
}

export function loadHexCompareSessionOptions(
  storage: Pick<Storage, 'getItem'> = localStorage,
): HexCompareSessionOptions {
  try {
    const raw = storage.getItem(hexCompareSessionOptionsStorageKey)

    if (!raw) {
      return defaultHexCompareSessionOptions()
    }

    const parsed = JSON.parse(raw) as Partial<HexCompareSessionOptions>

    return {
      windowLength: clampWindowLength(parsed.windowLength),
      diffOnly: Boolean(parsed.diffOnly),
      bytesPerRow: normalizeHexBytesPerRow(parsed.bytesPerRow),
    }
  } catch {
    return defaultHexCompareSessionOptions()
  }
}

export function saveHexCompareSessionOptions(
  state: HexCompareSessionOptions,
  storage: Pick<Storage, 'setItem'> = localStorage,
): void {
  storage.setItem(
    hexCompareSessionOptionsStorageKey,
    JSON.stringify({
      windowLength: clampWindowLength(state.windowLength),
      diffOnly: state.diffOnly,
      bytesPerRow: normalizeHexBytesPerRow(state.bytesPerRow),
    }),
  )
}
