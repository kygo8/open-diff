import { describe, expect, it } from 'vitest'
import { router } from './router'

describe('router', () => {
  it('registers the file format management route under settings', () => {
    const route = router.getRoutes().find((item) => item.path === '/settings/file-formats')

    expect(route?.name).toBe('file-formats')
  })
})
