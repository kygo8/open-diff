import { describe, expect, it } from 'vitest'
import { createAppI18n } from '@/i18n'
import { enUS } from './en-US'
import { zhCN } from './zh-CN'

describe('Simplified Chinese language pack', () => {
  it('registers zh-CN as an application locale', () => {
    const i18n = createAppI18n('zh-CN')

    expect(i18n.locale.value).toBe('zh-CN')
    expect(i18n.availableLocales.value.map((locale) => locale.code)).toContain('zh-CN')
    expect(i18n.t('app.ready')).toBe('就绪')
    expect(i18n.t('ui.textCompare')).toBe('文本比较')
  })

  it('covers every English resource key', () => {
    expect(Object.keys(zhCN.messages).sort()).toEqual(Object.keys(enUS.messages).sort())
  })
})
