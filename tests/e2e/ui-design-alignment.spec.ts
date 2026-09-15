import { expect, test } from '@playwright/test'
import { installTauriInvokeMock } from './helpers/tauriMock'

test.beforeEach(async ({ page }) => {
  await installTauriInvokeMock(page)
})

const routes = [
  ['home', '/'],
  ['text', '/compare/text'],
  ['text merge', '/merge/text'],
  ['folder', '/compare/folder'],
  ['folder sync', '/sync/folder'],
  ['folder merge', '/merge/folder'],
  ['table', '/compare/table'],
  ['hex', '/compare/hex'],
  ['picture', '/compare/picture'],
  ['registry', '/compare/registry'],
  ['media', '/compare/media'],
  ['text patch', '/patch/text'],
  ['remote profiles', '/settings/remote-profiles'],
  ['settings', '/settings'],
  ['reports scripts', '/reports/scripts'],
]

const denseStatusRoutes = new Set(['text', 'text merge', 'registry', 'text patch', 'hex'])

for (const [name, route] of routes) {
  test(`${name} uses dense workbench shell`, async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1280 })
    await page.goto(route)

    await expect(page.locator('[data-testid="app-shell"]')).toHaveAttribute(
      'data-dense-chrome',
      'true',
    )
    await expect(page.locator('.menu-bar')).toHaveCSS('height', '54px')
    await expect(page.locator('.sidebar')).toBeHidden()
    await expect(page.locator('.status-bar')).toHaveCSS(
      'height',
      denseStatusRoutes.has(name) ? '22px' : '24px',
    )
    await expect(page.locator('.command-bar')).toHaveCount(0)
    await expect(page.locator('.pathbar')).toHaveCount(0)
    await expect(page.locator('.page-head')).toHaveCount(0)
    await expect(page.locator('.workbench-shell')).toBeVisible()
    await expect(page.locator('.workbench-inspector').first()).toBeAttached()
  })
}
