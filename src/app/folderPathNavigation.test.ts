import { describe, expect, it } from 'vitest'
import {
  createFolderPathNavStack,
  folderPathNavBack,
  folderPathNavCanBack,
  folderPathNavCanForward,
  folderPathNavCommit,
  folderPathNavForward,
  folderPathPairsEqual,
  type FolderPathPair,
} from './folderPathNavigation'

describe('folderPathNavigation', () => {
  const equal = folderPathPairsEqual

  it('seeds the first commit without enabling Back', () => {
    const seeded = folderPathNavCommit(
      createFolderPathNavStack<FolderPathPair>(),
      { left: '/a', right: '/b' },
      equal,
    )

    expect(seeded.present).toEqual({ left: '/a', right: '/b' })
    expect(folderPathNavCanBack(seeded)).toBe(false)
    expect(folderPathNavCanForward(seeded)).toBe(false)
  })

  it('ignores duplicate commits at the present path', () => {
    const first = folderPathNavCommit(
      createFolderPathNavStack<FolderPathPair>(),
      { left: '/a', right: '/b' },
      equal,
    )
    const second = folderPathNavCommit(first, { left: '/a', right: '/b' }, equal)

    expect(second).toBe(first)
  })

  it('pushes history and clears Forward on a new commit', () => {
    let stack = folderPathNavCommit(
      createFolderPathNavStack<FolderPathPair>(),
      { left: '/a', right: '/b' },
      equal,
    )

    stack = folderPathNavCommit(stack, { left: '/a/child', right: '/b/child' }, equal)

    expect(folderPathNavCanBack(stack)).toBe(true)
    expect(folderPathNavCanForward(stack)).toBe(false)

    const back = folderPathNavBack(stack)

    expect(back).toBeDefined()
    expect(back?.entry).toEqual({ left: '/a', right: '/b' })
    expect(back ? folderPathNavCanForward(back.stack) : false).toBe(true)

    const resumed = folderPathNavCommit(
      back?.stack ?? stack,
      { left: '/other', right: '/b' },
      equal,
    )

    expect(folderPathNavCanForward(resumed)).toBe(false)
    expect(folderPathNavCanBack(resumed)).toBe(true)
  })

  it('walks Back and Forward with honest empty ends', () => {
    let stack = createFolderPathNavStack<FolderPathPair>()

    stack = folderPathNavCommit(stack, { left: '1', right: '1' }, equal)
    stack = folderPathNavCommit(stack, { left: '2', right: '2' }, equal)
    stack = folderPathNavCommit(stack, { left: '3', right: '3' }, equal)

    const firstBack = folderPathNavBack(stack)

    expect(firstBack?.entry).toEqual({ left: '2', right: '2' })
    stack = firstBack?.stack ?? stack

    const secondBack = folderPathNavBack(stack)

    expect(secondBack?.entry).toEqual({ left: '1', right: '1' })
    stack = secondBack?.stack ?? stack
    expect(folderPathNavBack(stack)).toBeUndefined()

    const firstForward = folderPathNavForward(stack)

    expect(firstForward?.entry).toEqual({ left: '2', right: '2' })
    stack = firstForward?.stack ?? stack

    const secondForward = folderPathNavForward(stack)

    expect(secondForward?.entry).toEqual({ left: '3', right: '3' })
    stack = secondForward?.stack ?? stack
    expect(folderPathNavForward(stack)).toBeUndefined()
  })
})
