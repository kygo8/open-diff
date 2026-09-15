import { describe, expect, it } from 'vitest'
import {
  defaultTableCompareSessionOptions,
  loadTableCompareSessionOptions,
  saveTableCompareSessionOptions,
  tableCompareSessionOptionsStorageKey,
} from './tableCompareSessionOptions'

describe('tableCompareSessionOptions', () => {
  it('round-trips key columns, delimiter, ignored columns, and matching defaults', () => {
    const storage = {
      store: {} as Record<string, string>,
      getItem(key: string) {
        return this.store[key] ?? null
      },
      setItem(key: string, value: string) {
        this.store[key] = value
      },
    }

    expect(loadTableCompareSessionOptions(storage)).toEqual(defaultTableCompareSessionOptions())

    saveTableCompareSessionOptions(
      {
        keyColumns: '0,1',
        delimiter: ';',
        ignoredColumns: ['col-a', ''],
        ignoreCase: true,
        firstRowIsHeader: false,
      },
      storage,
    )

    expect(storage.store[tableCompareSessionOptionsStorageKey]).toContain('0,1')
    expect(loadTableCompareSessionOptions(storage)).toEqual({
      keyColumns: '0,1',
      delimiter: ';',
      ignoredColumns: ['col-a'],
      ignoreCase: true,
      firstRowIsHeader: false,
    })
  })

  it('defaults missing ignoreCase/firstRowIsHeader honestly from older payloads', () => {
    const storage = {
      store: {
        [tableCompareSessionOptionsStorageKey]: JSON.stringify({
          keyColumns: '2',
          delimiter: '|',
          ignoredColumns: ['x'],
        }),
      } as Record<string, string>,
      getItem(key: string) {
        return this.store[key] ?? null
      },
      setItem(key: string, value: string) {
        this.store[key] = value
      },
    }

    expect(loadTableCompareSessionOptions(storage)).toEqual({
      keyColumns: '2',
      delimiter: '|',
      ignoredColumns: ['x'],
      ignoreCase: true,
      firstRowIsHeader: true,
    })
  })
})
