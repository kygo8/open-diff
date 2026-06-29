import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import process from 'node:process'

const routes = [
  ['home_workspace', '/'],
  ['text_compare', '/compare/text'],
  ['three_way_text_merge', '/merge/text'],
  ['folder_compare', '/compare/folder'],
  ['folder_sync', '/sync/folder'],
  ['three_way_folder_merge', '/merge/folder'],
  ['table_compare', '/compare/table'],
  ['hex_compare', '/compare/hex'],
  ['picture_compare', '/compare/picture'],
  ['registry_compare', '/compare/registry'],
  ['media_version_info', '/compare/media'],
  ['remote_archive_snapshot', '/settings/remote-profiles'],
  ['settings_rules_policy', '/settings'],
  ['reports_script_cli', '/reports/scripts'],
]

const baseUrl = process.env.UI_BASE_URL ?? 'http://127.0.0.1:1420'

await mkdir('.codex/screens', { recursive: true })

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({
  viewport: { width: 1600, height: 1280 },
  deviceScaleFactor: 1,
})

for (const [name, route] of routes) {
  await page.goto(`${baseUrl}${route}`, { waitUntil: 'load', timeout: 15_000 })
  await page.waitForTimeout(300)
  await page.screenshot({
    path: `.codex/screens/current_${name}.png`,
    fullPage: false,
  })
}

await browser.close()
