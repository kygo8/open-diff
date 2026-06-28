import { describe, expect, it } from 'vitest'
import { createAppI18n } from '@/i18n'
import { enUS } from './en-US'
import { zhTW } from './zh-TW'

describe('Traditional Chinese language pack', () => {
  it('registers zh-TW as an application locale', () => {
    const i18n = createAppI18n('zh-TW')

    expect(i18n.locale.value).toBe('zh-TW')
    expect(i18n.availableLocales.value.map((locale) => locale.code)).toContain('zh-TW')
    expect(i18n.t('app.ready')).toBe('就緒')
    expect(i18n.t('ui.textCompare')).toBe('文字比較')
  })

  it('covers every English resource key', () => {
    expect(Object.keys(zhTW.messages).sort()).toEqual(Object.keys(enUS.messages).sort())
  })
})
