import { describe, expect, it } from 'vitest'
import { router } from './router'

describe('router', () => {
  it('registers the file format management route under settings', () => {
    const route = router.getRoutes().find((item) => item.path === '/settings/file-formats')

    expect(route?.name).toBe('file-formats')
  })

  it('registers the folder merge route', () => {
    const route = router.getRoutes().find((item) => item.path === '/merge/folder')

    expect(route?.name).toBe('folder-merge')
  })

  it('registers the remote profile management route under settings', () => {
    const route = router.getRoutes().find((item) => item.path === '/settings/remote-profiles')

    expect(route?.name).toBe('remote-profiles')
  })

  it('registers the registry compare route', () => {
    const route = router.getRoutes().find((item) => item.path === '/compare/registry')

    expect(route?.name).toBe('registry-compare')
  })
})
